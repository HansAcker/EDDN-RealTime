import argparse
import asyncio
import signal
import sys
import zlib
import simplejson
import websockets
import zmq.asyncio

from typing import Any, Dict, Set, Tuple, Optional


options = argparse.Namespace(
	verbose = False,
	listen_addr = "127.0.0.1",
	listen_port = 8081,
	listen_path = None, # listen on socket path instead of TCP, e.g. "/run/eddn/eddnws.sock"
	zmq_url = "tcp://eddn.edcd.io:9500", # https://github.com/EDCD/EDDN#eddn-endpoints
	zmq_close_delay = 3.3,
	zmq_HEARTBEAT_IVL = 180,
	zmq_HEARTBEAT_TIMEOUT = 20,
	zmq_RECONNECT_IVL_MAX = 60,
	# zmq_RCVTIMEO = 600,
	ping_path = "/ping", # respond to health-checks if set
	ping_response = b"OK\n",
)


# TODO: professional logging

EL = "\x1b[K" # ANSI EL - clear from cursor to the end of the line

# prints on the same line to stdout (CR, sep, *objects, EL)
def print_same(*objects : Any, sep : Optional[str] = " ", end : Optional[str] = EL, flush : bool = True) -> None:
	print("\r", *objects, sep=sep, end=end, flush=flush)

# prints on stderr, clears line on stdout
def print_stderr(*objects : Any, sep : Optional[str] = " ", end : Optional[str] = None, flush : bool = True) -> None:
	if options.verbose: print_same()
	print(*objects, sep=sep, end=end, file=sys.stderr, flush=flush)


# active websocket connections
ws_conns : Set[websockets.WebSocketServerProtocol] = set()

# asyncio Tasks
zmq_task : Optional[asyncio.Task] = None
zmq_close_handler : Optional[asyncio.TimerHandle] = None

# ZMQ SUB socket
zmq_sub = zmq.asyncio.Context.instance().socket(zmq.SUB)


def zmq_init() -> None:
	zmq_sub.setsockopt(zmq.SUBSCRIBE, b"")

	zmq_sub.setsockopt(zmq.HEARTBEAT_IVL, int(options.zmq_HEARTBEAT_IVL * 1000))
	zmq_sub.setsockopt(zmq.HEARTBEAT_TIMEOUT, int(options.zmq_HEARTBEAT_TIMEOUT * 1000))
	zmq_sub.setsockopt(zmq.IPV6, True)
	zmq_sub.setsockopt(zmq.RECONNECT_IVL_MAX, int(options.zmq_RECONNECT_IVL_MAX * 1000))
	# zmq_sub.setsockopt(zmq.RCVTIMEO, int(options.zmq_RCVTIMEO * 1000))

def zmq_connect() -> None:
	zmq_sub.connect(options.zmq_url)

def zmq_disconnect() -> None:
	zmq_sub.disconnect(options.zmq_url)

def zmq_reconnect() -> None:
	zmq_disconnect()
	zmq_connect()


# relay messages from ZMQ to Websockets until ws_handler cancels the Task
async def relay_messages() -> None:
	while True:
		# don't block the loop during message bursts
		await asyncio.sleep(0)

		try:
			zmq_msg = await zmq_sub.recv()
		except Exception as e:
			print_stderr("receive error:", e)
			continue

		try:
			# EDDN messages are zlib-compressed JSON
			data = simplejson.loads(zlib.decompress(zmq_msg))
		except Exception as e:
			print_stderr("decode error:", e)
			continue

		if not data or type(data) is not dict or not "$schemaRef" in data:
			print_stderr("invalid message:", data)
			continue

		# normalize outgoing JSON intstead of forwarding the decompressed text as is
		# sort_keys can improve stream compression. EDDN dicts usually already are ordered
		try:
			websockets.broadcast(ws_conns, simplejson.dumps(data, sort_keys=True))
		except Exception as e:
			print_stderr("relay error:", e)

		if options.verbose:
			try:
				message = data["message"]

				if not "event" in message:
					print_same(f"({data['$schemaRef']})")
				elif "StarSystem" in message:
					print_same(f"{message['event']}: {message['StarSystem']}")
				else:
					print_same(message['event'])
			except Exception as e:
				print_same("unrecognized message:", e)

def relay_start() -> None:
	global zmq_task

	print_stderr("connecting ZMQ")
	zmq_connect()
	zmq_task = asyncio.create_task(relay_messages())

def relay_stop() -> None:
	global zmq_task

	if zmq_task is not None:
		zmq_task.cancel()
		zmq_task = None

	print_stderr("disconnecting ZMQ")
	zmq_disconnect()

def relay_close() -> None:
	global zmq_close_handler

	zmq_close_handler = asyncio.get_running_loop().call_later(options.zmq_close_delay, relay_stop)

def relay_cancel_close() -> None:
	global zmq_close_handler

	if zmq_close_handler is not None:
		zmq_close_handler.cancel()
		zmq_close_handler = None


async def ws_handler(websocket: websockets.WebSocketServerProtocol) -> None:
	ws_conns.add(websocket)
	print_stderr(f"client connected: {websocket.id} {websocket.remote_address} ({len(ws_conns)} active)")

	# cancel the timer
	relay_cancel_close()

	# first websocket connection starts the relay
	if zmq_task is None:
		relay_start()

	# wait until client disconnects
	# TODO: handle/discard incoming messages
	try:
		await websocket.wait_closed()
	except Exception as e:
		print_stderr("websocket error:", e)

	ws_conns.remove(websocket)
	print_stderr(f"client disconnected: {websocket.id} {websocket.remote_address} ({len(ws_conns)} active)")

	# last websocket stops the relay
	if not ws_conns and zmq_task:
		relay_close()


async def process_request(path: str, request_headers: websockets.Headers) -> Optional[Tuple[int, websockets.HeadersLike, bytes]]:
	if path == options.ping_path:
		return (200, [], options.ping_response)

	return None


async def server_start() -> None:
	print_stderr("starting websocket server")

	# set stop condition on signal
	loop = asyncio.get_running_loop()
	stop = loop.create_future()
	loop.add_signal_handler(signal.SIGTERM, stop.set_result, "SIGTERM")
	loop.add_signal_handler(signal.SIGINT, stop.set_result, "SIGINT")

	ws_args = {
		"process_request": process_request if options.ping_path else None,

		# server processes only incoming pongs
		"max_size": 4*1024, # limit incoming messages to 4k
		"max_queue": 4, # limit buffer to 4 messages
		"write_limit": 128*1024, # TODO: use? broadcast() ignores the limit

		"extensions": [
			# set compression window size to 32k (2^15)
			websockets.extensions.permessage_deflate.ServerPerMessageDeflateFactory(
				server_max_window_bits=15,
				compress_settings={"memLevel": 8},
			),
		],
	}

	if options.listen_path:
		print_stderr(f"socket path: {options.listen_path}")
		# TODO: set umask
		server = websockets.unix_serve(ws_handler, options.listen_path, **ws_args)
	else:
		print_stderr(f"TCP address: {options.listen_addr}:{options.listen_port}")
		server = websockets.serve(ws_handler, options.listen_addr, options.listen_port, **ws_args)

	# run the server until stop condition
	async with server:
		print_stderr(f"received {await stop}, stopping websocket server")


if __name__ == "__main__":
	def parse_args(namespace : argparse.Namespace) -> None:
		parser = argparse.ArgumentParser(
					description="Relay EDDN messages to websocket clients",
					epilog="https://github.com/HansAcker/EDDN-RealTime")

		parser.add_argument("-v", "--verbose", action="store_true", help=f"log events to stdout (default: {namespace.verbose})")

		group = parser.add_argument_group("ZMQ options")
		group.add_argument("-u", "--url", metavar="URL", dest="zmq_url", help=f"EDDN ZMQ URL (default: {namespace.zmq_url})")
		group.add_argument("-d", "--zmq_close_delay", metavar="SECONDS", dest="zmq_close_delay", type=float, help=f"delay closing ZMQ connection after the last websocket client leaves (default: {namespace.zmq_close_delay})")
		group.add_argument("--zmq_HEARTBEAT_IVL", metavar="SECONDS", dest="zmq_HEARTBEAT_IVL", type=float, help=f"set ZMQ ping interval, 0 to disable (default: {namespace.zmq_HEARTBEAT_IVL})")
		group.add_argument("--zmq_HEARTBEAT_TIMEOUT", metavar="SECONDS", dest="zmq_HEARTBEAT_TIMEOUT", type=float, help=f"set ZMQ ping timeout (default: {namespace.zmq_HEARTBEAT_TIMEOUT})")
		group.add_argument("--zmq_RECONNECT_IVL_MAX", metavar="SECONDS", dest="zmq_RECONNECT_IVL_MAX", type=float, help=f"set maximum reconnection interval (default: {namespace.zmq_RECONNECT_IVL_MAX})")
		# group.add_argument("--zmq_RCVTIMEO", metavar="SECONDS", dest="zmq_RCVTIMEO", type=float, help=f"set ZMQ receive timeout (default: {namespace.zmq_RCVTIMEO})")

		group = parser.add_argument_group("Websocket options")
		group.add_argument("-s", "--socket", metavar="PATH", dest="listen_path", help=f"listen on Unix socket if set (default: {namespace.listen_path})")
		group.add_argument("-a", "--addr", dest="listen_addr", help=f"listen on TCP address (default: {namespace.listen_addr})")
		group.add_argument("-p", "--port", dest="listen_port", type=int, help=f"listen on TCP port (default: {namespace.listen_port})")

		# TODO: add ws keepalive, timeouts, queue size/length

		parser.parse_args(namespace=namespace)

	parse_args(namespace=options)
	zmq_init()
	asyncio.run(server_start())
