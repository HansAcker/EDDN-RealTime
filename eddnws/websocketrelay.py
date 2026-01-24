import asyncio
import logging
import socket
import warnings
import zlib

from dataclasses import dataclass

# TODO: python >=3.9 supports dict, set, tuple
from typing import Any, AsyncIterable, Callable, Coroutine, Dict, Set, Optional, Union

import websockets
import websockets.asyncio.server as websockets_server


class WebsocketRelay:
	"""
	A WebSocket server that relays messages from an async iterator to connected clients.

	This class manages the lifecycle of the upstream data source, ensuring it only
	runs when clients are connected (with a configurable grace period). It provides
	connection limiting, back-pressure monitoring (slow client disconnection), and
	optional health check endpoints.

	It supports serving on both TCP ports and Unix sockets.

	Usage:
		relay = WebsocketRelay(iter_factory)
		await relay.serve(stop_future)
	"""

	@dataclass
	class Options:
		listen_addr: str = "127.0.0.1"
		listen_port: int = 8081
		listen_path: Optional[str] = None # listen on socket path instead of TCP, e.g. "/run/eddn/eddnws.sock"

		close_delay: float = 0 # >= 0: start/stop iterator on demand, -1: immediate start
		ping_path: Optional[str] = None # respond to health-checks if set, e.g. "/ping"

		send_text: bool = True # send iterator data in Text or Binary frames

		# default safety limits
		connection_limit: int = 1000 # max. number of active websockets accepted by ws_handler

		client_buffer_limit: int = 1 * 1024 * 1024 # per-client send buffer limit (bytes)
		client_check_interval: int = 0 # client buffer limit check interval


	def __init__(self, iter_factory: Callable[[], AsyncIterable[Union[bytes, str]]], *, logger: Optional[logging.Logger] = None, sock: Optional[socket.socket] = None, **kwargs) -> None:
		"""
		Initialize the WebsocketRelay.

		Args:
			iter_factory: A callable that returns an AsyncIterable[bytes | str].
				This factory is called to create a new upstream iterator whenever
				the first client connects (or reconnects after a full shutdown).
			logger: Custom logger instance. Defaults to __name__.
			**kwargs: Keyword arguments matching keys in WebsocketRelay.Options.
		"""
		# set this future to exit serve()
		self.stop: Optional[asyncio.Future] = None

		self.options = WebsocketRelay.Options(**kwargs)

		self._iter_factory = iter_factory
		self._iter: Optional[AsyncIterable[Union[bytes, str]]] = None

		self._logger = logger or logging.getLogger(__name__)

		self._sock: Optional[socket.socket] = sock

		# active websocket connections
		self._ws_conns: Set[websockets_server.ServerConnection] = set()

		# asyncio Tasks
		self._relay_task: Optional[asyncio.Task] = None
		self._relay_close_handler: Optional[asyncio.TimerHandle] = None
		self._monitor_task: Optional[asyncio.Task] = None

		# references to one-shot tasks. unreferenced tasks could be garbage-collected before/while running
		self._background_tasks: Set[asyncio.Task] = set()


	def _create_task(self, coro: Coroutine[Any, Any, Any]) -> None:
		"""
		Schedule a background task and maintain a strong reference to it.

		This prevents the task from being garbage collected during execution.

		Args:
			coro (Coroutine): The coroutine to schedule.
		"""
		task: asyncio.Task = asyncio.create_task(coro)
		self._background_tasks.add(task)
		# Clean up the reference once the task is complete
		task.add_done_callback(self._background_tasks.discard)


	async def _process_request(self, connection: websockets_server.ServerConnection, request: websockets.http11.Request) -> Optional[websockets.http11.Response]:
		"""
		Intercept the WebSocket handshake to handle HTTP requests (e.g., health checks).

		This hook is called by the websockets library before the handshake is completed.
		It allows the server to return a standard HTTP response (preventing the upgrade)
		or None to allow the upgrade to proceed.
		"""
		# Answer health checks with a hardcoded HTTP 200 response
		if self.options.ping_path and request.path == self.options.ping_path:
			return connection.respond(200, "OK\n")

		# Enforce connection limits strictly at the HTTP Upgrade level
		# This avoids the overhead of completing the WebSocket handshake just to close it immediately
		if "Upgrade" in request.headers and request.headers["Upgrade"] == "websocket":
			if self.options.connection_limit > 0 and len(self._ws_conns) >= self.options.connection_limit:
				self._logger.info(f"client rejected, connection limit reached ({len(self._ws_conns)} active)")
				return connection.respond(503, "Connection limit reached\n")

		return None


	def _relay_start(self) -> None:
		"""
		Start the upstream data iterator and the broadcasting task.
		
		This is called when the first client connects. It initializes the
		upstream iterator using the factory provided in __init__.
		"""

		self._logger.info("starting relay task")

		# Sanity check: ensure we don't start duplicate tasks
		# TODO: just move the relay_task check from ws_handler here?
		if (
			(self._relay_task is not None and not self._relay_task.done()) or
			(self._monitor_task is not None and not self._monitor_task.done())
		):
			warnings.warn("Relay tasks not done", RuntimeWarning)
			return

		self._iter = self._iter_factory()

		self._relay_task = asyncio.create_task(self._relay_messages())

		# Only start the buffer monitor if limits are actually configured
		if self.options.client_check_interval > 0 and self.options.client_buffer_limit > 0:
			self._monitor_task = asyncio.create_task(self._monitor_client_buffers())


	def _relay_stop(self) -> None:
		"""
		Stop the upstream data iterator and broadcasting task.

		This cancels the running tasks and clears references, effectively
		pausing the relay until the next client connects.
		"""

		self._logger.info("stopping relay task")

		if self._relay_close_handler is not None:
			self._relay_close_handler.cancel()
			self._relay_close_handler = None

		if self._relay_task is not None:
			self._relay_task.cancel()
			self._relay_task = None

		if self._monitor_task is not None:
			self._monitor_task.cancel()
			self._monitor_task = None

		self._iter = None


	def _relay_close(self) -> None:
		"""
		Schedule the relay shutdown after a configured delay.

		Used when the last client disconnects to allow a grace period for new connections
		before cutting the upstream link. This prevents "flapping" (rapid connect/disconnect)
		of the upstream source.
		"""
		if self._relay_close_handler is not None:
			self._relay_close_handler.cancel()

		self._relay_close_handler = asyncio.get_running_loop().call_later(self.options.close_delay, self._relay_stop)


	def _relay_close_cancel(self) -> None:
		"""
		Cancel any pending scheduled relay shutdown.

		Used when a new client connects during the grace period, keeping the
		upstream link alive.
		"""
		if self._relay_close_handler is not None:
			self._relay_close_handler.cancel()
			self._relay_close_handler = None


	async def _relay_messages(self) -> None:
		"""
		The "hot loop" that consumes the upstream iterator and broadcasts to clients.
		"""
		assert self.stop is not None, "Server not initialized"
		assert self._iter is not None, "Iterator not initialized"

		try:
			async for data in self._iter:
				# stream compression runs on the main thread
				self._broadcast(data)
				# yield to loop, in case of message bursts
				await asyncio.sleep(0)

		except Exception as e:
			# If the upstream iterator fails, terminate the server process,
			# let the external init system restart it.
			self._logger.exception("Iterator error, relay task exiting")

		finally:
			# Also terminate the server if the iterator ends
			if self._relay_task and not self.stop.done():
				self.stop.set_result("Iterator EOF")


	def _broadcast(self, message: Union[bytes, str]) -> None:
		"""
		A cut-down version of websockets.broadcast().

		Send Text or Binary frames from either bytes or str input to all connected clients.
		"""
		send_text = self.options.send_text

		# encode to bytes if necessary
		if isinstance(message, str):
			message = message.encode()

		# check write buffers here if not monitored periodically
		buffer_limit = self.options.client_buffer_limit if self.options.client_check_interval <= 0 else 0

		# TODO: use tuple(connections) if the loop ever awaits anything
		for connection in self._ws_conns:
			transport = connection.transport
			protocol = connection.protocol
			send_method = protocol.send_text if send_text else protocol.send_binary

			if protocol.state is not websockets.protocol.OPEN or not transport:
				continue

			if buffer_limit > 0 and buffer_limit <= transport.get_write_buffer_size():
				self._logger.info(f"client {connection.id} write buffer limit exceeded, disconnecting")
				self._create_task(connection.close(1008, "Write buffer overrun"))
				continue

			try:
				# compress and serialize frame, pass on to transport
				send_method(message)
				connection.send_data()
			except Exception as e:
				self._logger.warning("websockets write error: %s (%s)", e, connection.id)


	async def _ws_handler(self, websocket: websockets_server.ServerConnection) -> None:
		"""
		Handle the lifecycle of a single WebSocket client connection.

		Enforces connection limits, manages the relay task state (start/stop based on active count),
		and waits for the client to disconnect.

		Args:
			websocket (websockets.ServerConnection): The active client connection.
		"""

		# Secondary limit check: a burst of multiple handshakes could complete simultaneously,
		# bypassing the check in process_request.
		if self.options.connection_limit > 0 and len(self._ws_conns) >= self.options.connection_limit:
			self._logger.info(f"client rejected, connection limit reached: {websocket.remote_address} {websocket.id} ({len(self._ws_conns)} active)")
			# Close with code 1013 (Try Again Later)
			# TODO: websocket client currently does not back off on code 1013
			await websocket.close(1013, "Connection limit reached")
			return

		self._ws_conns.add(websocket)
		self._logger.info(f"client connected: {websocket.id} {websocket.remote_address} ({len(self._ws_conns)} active)")

		if self.options.close_delay >= 0:
			# Client connected: Cancel any pending shutdown of the upstream source
			self._relay_close_cancel()

			# If this is the first client (or the first after a grace period), start the upstream
			if self._relay_task is None or self._relay_task.done():
				self._relay_start()

		try:
			# Wait until client disconnects
			await websocket.wait_closed()

		except Exception as e:
			self._logger.warning("websocket error: %s (%s)", e, websocket.id)

		finally:
			self._ws_conns.discard(websocket)
			self._logger.info(f"client disconnected: {websocket.id} {websocket.remote_address} ({len(self._ws_conns)} active)")

			# If this was the last client, schedule the upstream source for shutdown
			if not self._ws_conns and self._relay_task and self.options.close_delay >= 0:
				self._relay_close()


	async def _monitor_client_buffers(self) -> None:
		"""
		Periodically monitor client write buffers and disconnect slow consumers.

		If a client exceeds the limit, they are disconnected with code 1008 (Policy Violation).
		"""
		try:
			while True:
				# Iterate over a copy of ws_conns
				for websocket in tuple(self._ws_conns):
					# Check if the library-internal transport buffer is full.
					if websocket.state == websockets.protocol.OPEN and websocket.transport and websocket.transport.get_write_buffer_size() > self.options.client_buffer_limit:
						self._logger.info(f"client {websocket.id} write buffer limit exceeded, disconnecting")
						self._create_task(websocket.close(1008, "Write buffer overrun"))

				await asyncio.sleep(self.options.client_check_interval)
		except Exception as e:
			# TODO: move into loop and log or terminate server?
			self._logger.exception("Monitor exception, monitor task exiting")


	async def serve(self, stop_future: Optional[asyncio.Future] = None) -> None:
		"""
		Start the WebSocket server and run until `stop_future` is set.

		Args:
			stop_future (Optional[asyncio.Future]): A future that, when completed,
				signals the server to shut down.
		"""
		self._logger.info("starting websocket server")

		loop = asyncio.get_running_loop()

		self.stop = stop_future or loop.create_future()

		# Configuration for the websockets library
		ws_args: Dict[str, Any] = {
			# Hook to handle HTTP requests (e.g. /ping) before WebSocket upgrade
			"process_request": self._process_request,

			# TODO: make origin check configurable (currently allows all origins)
			"origins": None,

			# Queue limits. The server processes only incoming pongs from clients.
			"max_size": 4 * 1024, # limit incoming messages to 4k
			"max_queue": 4, # limit buffer to 4 messages

			"extensions": [
				# set compression window size to 32k (2^15)
				websockets.extensions.permessage_deflate.ServerPerMessageDeflateFactory(
					server_max_window_bits = 15,
					compress_settings = {"memLevel": 8},
				),
			],
		}

		if self._sock:
			self._logger.info(f"Using socket: {self._sock.getsockname()}")
			server = websockets_server.serve(self._ws_handler, sock=self._sock, **ws_args)

		elif self.options.listen_path:
			self._logger.info(f"socket path: {self.options.listen_path}")
			# TODO: set umask for socket permissions
			# TODO: remove stale socket file?
			# mypy: unix_serve and serve types differ slightly in the wrapper
			server = websockets_server.unix_serve(self._ws_handler, self.options.listen_path, **ws_args) # type: ignore[assignment]

		else:
			self._logger.info(f"TCP address: {self.options.listen_addr}:{self.options.listen_port}")
			server = websockets_server.serve(self._ws_handler, self.options.listen_addr, self.options.listen_port, **ws_args)

		# Run the server context until the stop signal is received
		async with server:
			if self.options.close_delay < 0:
				self._relay_start()

			stop_signal = await self.stop
			self._relay_stop()

			self._logger.info(f"received '{stop_signal}', stopping websocket server")
			# Note: asyncio cleanup will handle closing individual connections




async def stdinter():
	"""Yields lines from stdin asynchronously."""
	reader = asyncio.StreamReader()
	protocol = asyncio.StreamReaderProtocol(reader)
	await asyncio.get_running_loop().connect_read_pipe(lambda: protocol, sys.stdin)

	while True:
		line = await reader.readline()
		if not line:
			break
		yield line


if __name__ == "__main__":
	import sys

	# use uvloop if available
	try:
		import uvloop
		uvloop.install()
	except ImportError:
		pass

	logging.basicConfig(level=logging.INFO,	format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

	try:
		asyncio.run(WebsocketRelay(stdinter, close_delay=-1).serve())
	except KeyboardInterrupt:
		pass
