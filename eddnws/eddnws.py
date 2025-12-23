import argparse
import asyncio
import logging
import signal
import sys
import zlib
import orjson
import websockets
import zmq.asyncio

# TODO: python >=3.9 supports dict, set, tuple
from typing import Any, Dict, Set, Tuple, Optional

# TODO: rework logger
logging.basicConfig(format="%(levelname)s: %(message)s - %(module)s.%(funcName)s()", level=logging.INFO)
logger = logging.getLogger("eddnws")


# TODO: possibly
# - classify arg parser
#   - use dataclass for options/defaults
# - configure logging properly
#   - pass optional logger in constructor kwargs/options
#   - use a different log level for websocket's logger
#   - set proper name
# - rework for websockets >=14 (process_request, ws_handler)
# - pass optional ZMQ context in constructor
# - move signal handling out of server?
# - support external socket passing
# - handle/discard incoming client messages
#   - the current client should not send anything and would just get itself disconnected for missing pongs
# - re-think monitor_task lifecycle, make its timing configurable
# - use SO_REUSEPORT on websocket to attach multiple script instances to the same port
# - InterpreterPoolExecutor could be better suited to offload JSON, requires python >=3.14
# - continue to ignore signal handler incompatibility with native Windows, the script runs under WSL
# - keep compatibility with python 3.8 for now
# - review LLM-generated docstrings


class EDDNWebsocketServer:
	"""
	A Websocket server that relays EDDN (Elite Dangerous Data Network) messages
	from a ZMQ subscription to connected Websocket clients.
	"""

	# TODO: use plain dict for instance options, keep convenient Namespace on the class variable with defaults?
	#		- or give in and make it a dataclass
	options = argparse.Namespace(
		verbosity = 0, # translates to log level

		listen_addr = "127.0.0.1",
		listen_port = 8081,
		listen_path = None, # listen on socket path instead of TCP, e.g. "/run/eddn/eddnws.sock"

		ping_path = "/ping", # respond to health-checks if set

		# default safety limits
		msg_size_limit = 4 * 1024 * 1024, # decompressed JSON size limit (bytes)
		client_buffer_limit = 1 * 1024 * 1024, # per-client send buffer limit (bytes)
		connection_limit = 1000, # max. number of active websockets accept by ws_handler

		zmq_url = "tcp://eddn.edcd.io:9500", # https://github.com/EDCD/EDDN#eddn-endpoints
		zmq_close_delay = 3.3,
		zmq_HEARTBEAT_IVL = 180,
		zmq_HEARTBEAT_TIMEOUT = 20,
		zmq_RECONNECT_IVL_MAX = 60,
		# zmq_RCVTIMEO = 600, # TODO: why was RCVTIMEO defined but not used, was there a reason?
		zmq_RCVHWM = 1000, # TODO: should this be called msg_backlog_limit?
	)


	def __init__(self, options: Dict[str, Any]) -> None:
		"""
		Initialize the EDDN Websocket Server instance.

		Args:
			options (Dict[str, Any]): A dictionary of configuration options to override defaults.
									  Merged into self.options.

		Returns:
			None
		"""
		# TODO: properly merge options? python >= 3.9 supports dict1 | dict2
		self.options = argparse.Namespace(**{**vars(self.options), **options})

		# TODO: pass optional logger in constructor/options or handle either -v[v] or -d N to set log level
		self._logger = logger

		# active websocket connections
		self._ws_conns : Set[websockets.WebSocketServerProtocol] = set()

		# asyncio Tasks
		self._relay_task : Optional[asyncio.Task] = None
		self._relay_close_handler : Optional[asyncio.TimerHandle] = None
		self._monitor_task : Optional[asyncio.Task] = None

		# ZMQ Context and Socket
		self._zmq_ctx : zmq.asyncio.Context = zmq.asyncio.Context.instance()
		self._zmq_sub : Optional[zmq.asyncio.Socket] = None


	# TODO: this method changed between websockets 13 and 14, support both with version switch?
	async def _process_request(self, path: str, request_headers: websockets.Headers) -> Optional[Tuple[int, websockets.HeadersLike, bytes]]:
		"""
		Intercept the WebSocket handshake to handle HTTP requests (e.g., health checks).

		This hook is called by the websockets library before the handshake is completed.

		Args:
			path (str): The request path (URI).
			request_headers (websockets.Headers): The HTTP request headers.

		Returns:
			Optional[Tuple[int, websockets.HeadersLike, bytes]]:
				A tuple containing (HTTP Status Code, Headers, Response Body) if the request
				is intercepted (e.g., for /ping).
				Returns None to let the WebSocket handshake proceed normally.
		"""
		if path == self.options.ping_path:
			return (200, [("Content-Type", "text/plain")], b"OK\n")

		return None


	def _zmq_socket_init(self) -> None:
		"""
		Configure the ZMQ Subscriber socket options.

		Sets subscription filters (empty/all), IPv6 support, heartbeats, and high-water marks.

		Args:
			None

		Returns:
			None
		"""
		# EDDN doesn't support any subscription filters
		self._zmq_sub.setsockopt(zmq.SUBSCRIBE, b"")

		self._zmq_sub.setsockopt(zmq.IPV6, True)
		self._zmq_sub.setsockopt(zmq.HEARTBEAT_IVL, int(self.options.zmq_HEARTBEAT_IVL * 1000))
		self._zmq_sub.setsockopt(zmq.HEARTBEAT_TIMEOUT, int(self.options.zmq_HEARTBEAT_TIMEOUT * 1000))
		self._zmq_sub.setsockopt(zmq.RECONNECT_IVL_MAX, int(self.options.zmq_RECONNECT_IVL_MAX * 1000))
		# self._zmq_sub.setsockopt(zmq.RCVTIMEO, int(self.options.zmq_RCVTIMEO * 1000))
		self._zmq_sub.setsockopt(zmq.RCVHWM, int(self.options.zmq_RCVHWM))

	def _zmq_connect(self) -> None:
		"""
		Initialize the ZMQ socket and connect to the upstream EDDN relay.

		If a socket already exists, it logs a warning and returns immediately.

		Args:
			None

		Returns:
			None
		"""
		if self._zmq_sub is not None:
			self._logger.warning("zmq_connect(): zmq_sub is not None")
			return

		self._zmq_sub = self._zmq_ctx.socket(zmq.SUB)
		self._zmq_socket_init()

		self._zmq_sub.connect(self.options.zmq_url)

	def _zmq_disconnect(self) -> None:
		"""
		Disconnect and close the ZMQ socket.

		Args:
			None

		Returns:
			None
		"""
		if self._zmq_sub is None:
			self._logger.warning("zmq_disconnect(): zmq_sub is None")
			return

		self._zmq_sub.close(linger=0)
		self._zmq_sub = None

	def _zmq_reconnect(self) -> None:
		"""
		Perform a full ZMQ reconnection cycle (disconnect then connect).

		Args:
			None

		Returns:
			None
		"""
		self._zmq_disconnect()
		self._zmq_connect()


	def _relay_start(self) -> None:
		"""
		Start the message relay process.

		Connects to ZMQ and spawns the `_relay_messages` and `_monitor_client_buffers` tasks
		if they are not already running.

		Args:
			None

		Returns:
			None
		"""
		if self._relay_task is not None and not self._relay_task.done():
			self._logger.warning("relay_start(): zmq_task is not done")
			return

		self._logger.info("connecting ZMQ")
		self._zmq_connect()

		self._relay_task = asyncio.create_task(self._relay_messages())
		self._monitor_task = asyncio.create_task(self._monitor_client_buffers())

	def _relay_stop(self) -> None:
		"""
		Stop the message relay process.

		Cancels the relay and monitor tasks and disconnects the ZMQ socket.

		Args:
			None

		Returns:
			None
		"""
		if self._relay_task is not None:
			self._relay_task.cancel()
			self._relay_task = None

		if self._monitor_task is not None:
			self._monitor_task.cancel()
			self._monitor_task = None

		if self._zmq_sub is not None:
			self._logger.info("disconnecting ZMQ")
			self._zmq_disconnect()

	def _relay_close(self) -> None:
		"""
		Schedule the relay shutdown after a configured delay.

		Used when the last client disconnects to allow a grace period for new connections
		before cutting the upstream link.

		Args:
			None

		Returns:
			None
		"""
		if self._relay_close_handler is not None:
			self._relay_close_handler.cancel()

		self._relay_close_handler = asyncio.get_running_loop().call_later(self.options.zmq_close_delay, self._relay_stop)

	def _relay_close_cancel(self) -> None:
		"""
		Cancel any pending scheduled relay shutdown.

		Used when a new client connects during the grace period.

		Args:
			None

		Returns:
			None
		"""
		if self._relay_close_handler is not None:
			self._relay_close_handler.cancel()
			self._relay_close_handler = None


	# the hot loop
	# relay messages from ZMQ to Websockets until ws_handler cancels the Task
	async def _relay_messages(self) -> None:
		"""
		The main relay loop: receives from ZMQ, decodes, and broadcasts to websockets.

		It handles:
		1. Receiving raw bytes from ZMQ.
		2. Offloading decompression/decoding to an executor.
		3. Broadcasting the result to all connected clients.

		Args:
			None

		Returns:
			None

		Exceptions:
			Catches and logs all Exceptions within the loop to prevent crash,
			breaking only on fatal ZMQ receive errors.
		"""
		loop = asyncio.get_running_loop()

		while self._zmq_sub is not None:
			try:
				zmq_msg = await self._zmq_sub.recv()
			except Exception as e:
				# TODO: a fatal ZMQ socket exception stops the relay but does not clean up relay_task
				#		- the next client connection would restart the relay task but not the socket
				#		 - count failures, reconnect ZMQ, backoff delay?
				#		 - or terminate the server?
				self._logger.exception("receive error, relay task exiting:", e)
				break

			try:
				# run incoming decompression/parsing in executor
				data = await loop.run_in_executor(None, self._decode_msg, zmq_msg)
			except Exception as e:
				self._logger.exception("decode error:", e)
				continue

			try:
				# websocket stream compression runs on main thread
				websockets.broadcast(self._ws_conns, data)
			except Exception as e:
				self._logger.exception("relay error:", e)


	# EDDN messages are zlib-compressed JSON
	def _decode_msg(self, zmq_msg: bytes) -> str:
		"""
		Decompress and normalize the incoming ZMQ message.

		Decompresses zlib data, parses it as JSON, and re-serializes it with sorted keys
		to ensure a consistent Text Frame output for clients.

		Args:
			zmq_msg (bytes): The raw zlib-compressed bytes received from ZMQ.

		Returns:
			str: The normalized, JSON-encoded string.

		Raises:
			ValueError: If the decompressed size exceeds msg_size_limit.
			ValueError: If the message is malformed (unconsumed tail).
			ValueError: If the JSON is missing the required '$schemaRef' key.
			zlib.error: If decompression fails.
			orjson.JSONDecodeError: If the decompressed data is not valid JSON.
		"""
		dobj = zlib.decompressobj()

		json_text = dobj.decompress(zmq_msg, self.options.msg_size_limit)

		if dobj.unconsumed_tail:
			raise ValueError("size limit exceeded")

		# parse incoming JSON. make sure it looks like a valid EDDN message
		data = orjson.loads(json_text)

		if not (isinstance(data, dict) and "$schemaRef" in data):
			raise ValueError("missing $schemaRef")

		# normalize outgoing JSON intstead of forwarding the decompressed text as is
		# - sort_keys can improve stream compression. EDDN dicts usually already are ordered
		# - orjson.dumps() returns bytes but websocket.broadcast() needs str to send a Text frame as expected by the client

		return orjson.dumps(data, option=orjson.OPT_SORT_KEYS).decode("utf-8")


	async def _ws_handler(self, websocket: websockets.WebSocketServerProtocol) -> None:
		"""
		Handle the lifecycle of a single WebSocket client connection.

		Enforces connection limits, manages the relay task state (start/stop based on active count),
		and waits for the client to disconnect.

		Args:
			websocket (websockets.WebSocketServerProtocol): The active client connection.

		Returns:
			None

		Exceptions:
			Catches and logs generic Exceptions during the connection lifetime.
		"""
		# TODO: check len(ws_conns) before the websocket handshake, after the HTTP Upgrade (process_request)?
		# TODO: the websocket client does not log or back off on code 1013 yet

		if (self.options.connection_limit > 0 and len(self._ws_conns) >= self.options.connection_limit):
			await websocket.close(1013, "Connection limit reached")
			return

		self._ws_conns.add(websocket)
		self._logger.info(f"client connected: {websocket.id} {websocket.remote_address} ({len(self._ws_conns)} active)")

		# cancel the timer
		self._relay_close_cancel()

		# first websocket connection starts the relay
		if self._relay_task is None or self._relay_task.done():
			self._relay_start()

		# wait until client disconnects
		try:
			await websocket.wait_closed()

		except Exception as e:
			self._logger.warning(f"websocket error {websocket.id}:", e)

		finally:
			self._ws_conns.discard(websocket)
			self._logger.info(f"client disconnected: {websocket.id} {websocket.remote_address} ({len(self._ws_conns)} active)")

			# last websocket stops the relay
			if not self._ws_conns and self._relay_task:
				self._relay_close()


	async def _monitor_client_buffers(self) -> None:
		"""
		Periodically monitor client write buffers and disconnect slow consumers.

		Checks the write buffer size of every active connection once per second.
		If a client exceeds `client_buffer_limit`, they are disconnected with code 1008.

		Args:
			None

		Returns:
			None
		"""
		while self.options.client_buffer_limit > 0:
			slow_clients = [
				# iterate over a copy of ws_conns
				# TODO: if ws_conns gets large, a better solution than list(ws_conns) might be needed
				websocket for websocket in list(self._ws_conns)
					# websockets could close the transport before ws_handler removes the client from the set
					if websocket.transport and websocket.transport.get_write_buffer_size() > self.options.client_buffer_limit
			]

			for websocket in slow_clients:
				self._logger.info(f"client {websocket.id} write buffer limit exceeded, disconnecting")
				asyncio.create_task(websocket.close(1008, "Write buffer overrun"))

			await asyncio.sleep(1)


	async def serve(self) -> None:
		"""
		Configure and run the WebSocket server main loop.

		Sets up signal handlers for graceful shutdown, configures server options
		(including compression), and binds to either a Unix socket or a TCP port.

		Args:
			None

		Returns:
			None
		"""
		self._logger.info("starting websocket server")

		# set stop condition on signal
		loop = asyncio.get_running_loop()
		stop = loop.create_future()
		for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
			loop.add_signal_handler(sig, stop.set_result, sig.name)

		# TODO: add config options
		ws_args = {
			"process_request": self._process_request if self.options.ping_path else None,

			# server processes only incoming pongs
			"max_size": 4*1024, # limit incoming messages to 4k
			"max_queue": 4, # limit buffer to 4 messages
			"write_limit": 128*1024, # TODO: use? broadcast() ignores the limit

			"extensions": [
				# set compression window size to 32k (2^15)
				websockets.extensions.permessage_deflate.ServerPerMessageDeflateFactory(
					server_max_window_bits = 15,
					compress_settings = {"memLevel": 8},
				),
			],
		}

		if self.options.listen_path:
			self._logger.info(f"socket path: {self.options.listen_path}")
			# TODO: set umask
			# TODO: remove stale socket file?
			server = websockets.unix_serve(self._ws_handler, self.options.listen_path, **ws_args)
		else:
			self._logger.info(f"TCP address: {self.options.listen_addr}:{self.options.listen_port}")
			server = websockets.serve(self._ws_handler, self.options.listen_addr, self.options.listen_port, **ws_args)

		# run the server until stop condition
		async with server:
			stop_signal = await stop
			self._relay_stop()
			self._logger.info(f"received {stop_signal}, stopping websocket server")
			# TODO: explicitly close all client connections before asyncio does it on exit?




if __name__ == "__main__":
	try:
		import uvloop
		uvloop.install()
	except ImportError as e:
		pass


	def parse_args(defaults : argparse.Namespace = argparse.Namespace()) -> argparse.Namespace:
		parser = argparse.ArgumentParser(
					description="Relay EDDN messages to websocket clients",
					epilog="https://github.com/HansAcker/EDDN-RealTime")

		namespace = argparse.Namespace(**{**vars(EDDNWebsocketServer.options), **vars(defaults)})

		# TODO: clarify help string? it actually de-creases the log level which makes it more verbose
		parser.add_argument("-v", "--verbose", action="count", dest="verbosity", default=0, help=f"increase log level")

		group = parser.add_argument_group("ZMQ options")
		group.add_argument("-u", "--url", metavar="URL", dest="zmq_url", help=f"EDDN ZMQ URL (default: {namespace.zmq_url})")
		group.add_argument("-d", "--zmq-close-delay", metavar="SECONDS", dest="zmq_close_delay", type=float, help=f"delay closing ZMQ connection after the last websocket client leaves (default: {namespace.zmq_close_delay})")
		group.add_argument("--size-limit", metavar="BYTES", dest="msg_size_limit", type=int, help=f"set decompressed JSON size limit (default: {namespace.msg_size_limit})")
		group.add_argument("--zmq-HEARTBEAT_IVL", metavar="SECONDS", dest="zmq_HEARTBEAT_IVL", type=float, help=f"set ZMQ ping interval, 0 to disable (default: {namespace.zmq_HEARTBEAT_IVL})")
		group.add_argument("--zmq-HEARTBEAT_TIMEOUT", metavar="SECONDS", dest="zmq_HEARTBEAT_TIMEOUT", type=float, help=f"set ZMQ ping timeout (default: {namespace.zmq_HEARTBEAT_TIMEOUT})")
		group.add_argument("--zmq-RECONNECT_IVL_MAX", metavar="SECONDS", dest="zmq_RECONNECT_IVL_MAX", type=float, help=f"set maximum reconnection interval (default: {namespace.zmq_RECONNECT_IVL_MAX})")
		# group.add_argument("--zmq-RCVTIMEO", metavar="SECONDS", dest="zmq_RCVTIMEO", type=float, help=f"set ZMQ receive timeout (default: {namespace.zmq_RCVTIMEO})")
		group.add_argument("--zmq-RCVHWM", metavar="NUM", dest="zmq_RCVHWM", type=int, help=f"set ZMQ message backlog limit, 0 to disable (default: {namespace.zmq_RCVHWM})")

		group = parser.add_argument_group("Websocket options")
		group.add_argument("-s", "--socket", metavar="PATH", dest="listen_path", help=f"listen on Unix socket if set (default: {namespace.listen_path})")
		group.add_argument("-a", "--addr", dest="listen_addr", help=f"listen on TCP address (default: {namespace.listen_addr})")
		group.add_argument("-p", "--port", dest="listen_port", type=int, help=f"listen on TCP port (default: {namespace.listen_port})")
		group.add_argument("--client-buffer-limit", metavar="BYTES", dest="client_buffer_limit", type=int, help=f"set per-client write buffer limit, 0 to disable (default: {namespace.client_buffer_limit})")
		group.add_argument("--connection-limit", metavar="NUM", dest="connection_limit", type=int, help=f"set websocket connection count limit, 0 to disable (default: {namespace.connection_limit})")

		# TODO: add ws keepalive, timeouts, queue size/length

		parser.parse_args(namespace=namespace)

		return namespace


	options = parse_args()
	asyncio.run(EDDNWebsocketServer(vars(options)).serve())
