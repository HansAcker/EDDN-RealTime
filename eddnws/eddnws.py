import argparse
import asyncio
import signal
import sys
import zlib
import simplejson
import websockets
import zmq.asyncio
from zmq.asyncio import Context


verbose = False

# https://github.com/EDCD/EDDN#eddn-endpoints
eddn_url = "tcp://eddn.edcd.io:9500"

listen_addr = "127.0.0.1"
listen_port = 8081
listen_path = None # listen on socket path instead of TCP, e.g. "/run/eddn/eddnws.sock"


# TODO: professional logging

EL = "\x1b[K" # ANSI EL - clear from cursor to the end of the line

# prints on the same line to stdout (CR, sep, *objects, EL)
def print_same(*objects, sep=" ", end=EL, flush=True):
	print("\r", *objects, sep=sep, end=end, flush=flush)

# prints on stderr, clears line on stdout
def print_stderr(*objects, sep=" ", end=None, flush=True):
	if verbose: print_same()
	print(*objects, sep=sep, end=end, file=sys.stderr, flush=flush)


zmq_ctx = Context.instance()
zmq_task = None

zmq_sub = zmq_ctx.socket(zmq.SUB)
zmq_sub.setsockopt(zmq.SUBSCRIBE, b"")
zmq_sub.setsockopt(zmq.RECONNECT_IVL_MAX, 60 * 1000)
zmq_sub.setsockopt(zmq.RCVTIMEO, 600 * 1000)

def zmq_connect():
	zmq_sub.connect(eddn_url)

def zmq_disconnect():
	zmq_sub.disconnect(eddn_url)

def zmq_reconnect():
	zmq_disconnect()
	zmq_connect()


# active websocket connections
ws_conns = set()


# relay messages from ZMQ to Websockets until ws_handler cancels the Task
async def relay_messages():
	while True:
		try:
			zmq_msg = await zmq_sub.recv()
		except Exception as e:
			print_stderr("receive error:", e)
			# TODO: is that the right thing to do?
			#zmq_reconnect()
			continue

		eddn_msg = {}

		try:
			# EDDN messages are zlib-compressed JSON
			eddn_msg = simplejson.loads(zlib.decompress(zmq_msg))
		except Exception as e:
			print_stderr("decode error:", e)
			continue

		if not eddn_msg:
			if verbose: print_same("empty message", end=EL + "\n")
			continue

		try:
			websockets.broadcast(ws_conns, simplejson.dumps(eddn_msg))
		except Exception as e:
			print_stderr("relay error:", e)

		if verbose:
			try:
				message = eddn_msg["message"]

				if not "event" in message:
					print_same(f"({eddn_msg['$schemaRef']})")
				elif "StarSystem" in message:
					print_same(f"{message['event']}: {message['StarSystem']}")
				else:
					print_same(message['event'])
			except Exception as e:
				print_same("unrecognized message:", e)

		# don't block the loop during message bursts
		await asyncio.sleep(0)


async def ws_handler(websocket, path):
	global zmq_task

	ws_conns.add(websocket)
	print_stderr(f"client connected: {websocket.id} {websocket.remote_address} ({len(ws_conns)} active)")

	# first websocket connection starts the relay
	if zmq_task is None:
		print_stderr("connecting ZMQ")
		zmq_connect()
		zmq_task = asyncio.create_task(relay_messages())

	try:
		await websocket.wait_closed()
	finally:
		ws_conns.remove(websocket)
		print_stderr(f"client disconnected: {websocket.id} {websocket.remote_address} ({len(ws_conns)} active)")

	# last websocket stops the relay
	if not ws_conns and zmq_task:
		print_stderr("disconnecting ZMQ")
		zmq_task.cancel()
		zmq_task = None
		zmq_disconnect()


async def server():
	print_stderr("starting websocket server")

	# set stop condition on signal
	loop = asyncio.get_running_loop()
	stop = loop.create_future()
	loop.add_signal_handler(signal.SIGTERM, stop.set_result, "SIGTERM")
	loop.add_signal_handler(signal.SIGINT, stop.set_result, "SIGINT")

	if listen_path:
		print_stderr(f"socket path: {listen_path}")
		# TODO: set umask
		server = websockets.unix_serve(ws_handler, listen_path)
	else:
		print_stderr(f"TCP address: {listen_addr}:{listen_port}")
		server = websockets.serve(ws_handler, listen_addr, listen_port)

	async with server:
		print_stderr(f"received {await stop}, stopping websocket server")


if __name__ == "__main__":
	parser = argparse.ArgumentParser()
	parser.add_argument("-v", "--verbose", default=verbose, action="store_true", help=f"log events to stdout, default: {verbose}")
	parser.add_argument("-u", "--url", default=eddn_url, help=f"EDDN URL, default: {eddn_url}")
	parser.add_argument("-s", "--socket", metavar="PATH", default=listen_path, help=f"listen on Unix socket if set, default: {listen_path}")
	parser.add_argument("-a", "--addr", default=listen_addr, help=f"listen on TCP address, default: {listen_addr}")
	parser.add_argument("-p", "--port", default=listen_port, type=int, help=f"listen on TCP port, default: {listen_port}")

	args = parser.parse_args()

	verbose = args.verbose
	eddn_url = args.url
	listen_addr = args.addr
	listen_port = args.port
	listen_path = args.socket

	args = None
	parser = None

	asyncio.run(server())
