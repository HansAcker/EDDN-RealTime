import asyncio
import logging
import zlib

from dataclasses import dataclass

# TODO: python >=3.9 supports dict, set, tuple
from typing import Any, AsyncGenerator, Dict, Optional

import orjson
import zmq.asyncio


class EDDNReceiver:
	"""
	A ZMQ subscriber that yields normalized EDDN messages as bytes.

	This class handles the connection to the EDDN ZMQ relay, manages the
	socket lifecycle, handles automatic reconnection

	Usage:
		receiver = EDDNReceiver([options])
		async for msg in receiver:
			print(msg.decode("utf-8"))
	"""

	@dataclass
	class Options:
		"""
		Configuration options for the EDDN receiver and underlying ZMQ socket.

		Attributes:
			zmq_url (str): The ZMQ endpoint URL to connect to.

			msg_size_limit (int): Maximum allowed size (in bytes) for the decompressed JSON payload.
				If 0, no limit is applied.
			ignore_decode_errors (bool): If True, decoding exceptions (zlib/json) are logged and the
				stream continues. If False, exceptions are raised.

			zmq_CONNECT_TIMEOUT (float): ZMQ_CONNECT_TIMEOUT in seconds.
			zmq_HEARTBEAT_IVL (float): ZMQ_HEARTBEAT_IVL in seconds.
			zmq_HEARTBEAT_TIMEOUT (float): ZMQ_HEARTBEAT_TIMEOUT in seconds.
			zmq_RECONNECT_IVL_MAX (float): ZMQ_RECONNECT_IVL_MAX in seconds.
			zmq_MAXMSGSIZE (int): ZMQ_MAXMSGSIZE limit for the raw compressed message. -1 for unlimited.
			zmq_RCVHWM (int): ZMQ_RCVHWM (Receive High Water Mark) for the internal message backlog.
		"""
		zmq_url: str = "tcp://eddn.edcd.io:9500" # https://github.com/EDCD/EDDN#eddn-endpoints

		msg_size_limit: int = 0 # decompressed JSON size limit (bytes) if > 0
		ignore_decode_errors: bool = True # ignore decoding errors and continue

		zmq_CONNECT_TIMEOUT: float = 0
		zmq_HEARTBEAT_IVL: float = 180
		zmq_HEARTBEAT_TIMEOUT: float = 20
		zmq_RECONNECT_IVL_MAX: float = 60

		zmq_MAXMSGSIZE: int = -1 # compressed ZMQ message size limit if >= 0
		zmq_RCVHWM: int = 1000 # TODO: should this be called msg_backlog_limit?
		# TODO: set ZMQ_LINGER = 0?


	def __init__(self, *, logger: Optional[logging.Logger] = None, **kwargs) -> None:
		"""
		Initialize the EDDNReceiver.

		Args:
			logger (logging.Logger, optional): Custom logger instance. Defaults to __name__.
			**kwargs: Keyword arguments matching keys in EDDNReceiver.Options.
		"""
		self.options = EDDNReceiver.Options(**kwargs)

		if logger is None:
			logger = logging.getLogger(__name__)
		self._logger = logger

		self._ctx: zmq.asyncio.Context = zmq.asyncio.Context.instance()


	async def __aiter__(self) -> AsyncGenerator[bytes, None]:
		"""
		The main generator loop. Connects on start, disconnects on exit/cancellation.

		Yields:
			bytes: The decompressed, normalized (canonical JSON) payload.
		
		Raises:
			zmq.ZMQError: If a ZMQ error occurs.
			see _decode_msg(): If ignore_decode_errors is False.
		"""

		socket = self._ctx.socket(zmq.SUB)
		self._configure_socket(socket)
		
		self._logger.info(f"Connecting to ZMQ: {self.options.zmq_url}")
		socket.connect(self.options.zmq_url)

		loop = asyncio.get_running_loop()

		try:
			while True:
				try:
					zmq_msg = await socket.recv()
					# TODO: profile live - most messages are small. enough that decoding is faster than a context switch?
					# yield self._decode_msg(zmq_msg, self.options.msg_size_limit)
					yield await loop.run_in_executor(None, self._decode_msg, zmq_msg, self.options.msg_size_limit)

				except Exception as e:
					self._logger.error(f"Stream error: {e}")

					# Raise ZMQ Errors as they might indicate connection issues
					if isinstance(e, zmq.ZMQError):
						raise

					# Skip malformed payloads (zlib/json errors) if configured
					if self.options.ignore_decode_errors:
						continue

					raise

		finally:
			# Clean up when the consumer stops or cancels the task
			self._logger.info("Closing ZMQ socket")
			socket.close(linger=0)


	def _configure_socket(self, socket: zmq.asyncio.Socket) -> None:
		"""
		Apply ZMQ socket options based on the configuration.

		Args:
			socket (zmq.asyncio.Socket): The socket instance to configure.
		"""
		socket.setsockopt(zmq.SUBSCRIBE, b"") # EDDN does not have topics
		socket.setsockopt(zmq.IPV6, True)
		socket.setsockopt(zmq.CONNECT_TIMEOUT, int(self.options.zmq_CONNECT_TIMEOUT * 1000))
		socket.setsockopt(zmq.HEARTBEAT_IVL, int(self.options.zmq_HEARTBEAT_IVL * 1000))
		socket.setsockopt(zmq.HEARTBEAT_TIMEOUT, int(self.options.zmq_HEARTBEAT_TIMEOUT * 1000))
		socket.setsockopt(zmq.RECONNECT_IVL_MAX, int(self.options.zmq_RECONNECT_IVL_MAX * 1000))
		socket.setsockopt(zmq.MAXMSGSIZE, int(self.options.zmq_MAXMSGSIZE))
		socket.setsockopt(zmq.RCVHWM, int(self.options.zmq_RCVHWM))
		socket.setsockopt(zmq.RCVTIMEO, -1) # no timeout in recv(), never raise zmq.Again


	@staticmethod
	def _decode_msg(msg: bytes, size_limit: int = 0) -> bytes:
		"""
		Decompresses and validates the received payload.
		
		Args:
			msg (bytes): The compressed payload.
			size_limit (int): Maximum allowable decompressed size, 0 for unlimited.

		Returns:
			bytes: Canonicalized JSON bytes.

		Raises:
			ValueError: If zlib/JSON payload does not pass validation.
			zlib.error: If decompression fails.
			orjson.JSONDecodeError: If JSON parsing fails.
		"""

		if not msg:
			raise ValueError("Empty payload")

		dobj = zlib.decompressobj()
		json_text = dobj.decompress(msg, size_limit)
		
        # If max_length is reached, zlib pauses before consuming the stream footer (CRC/Adler32).
        # These unverified bytes remain in unconsumed_tail, ensuring it is non-empty if the limit is hit.
		if dobj.unconsumed_tail:
			raise ValueError("Size limit exceeded")

		if dobj.unused_data:
			raise ValueError("Trailing garbage")

		if not dobj.eof:
			raise ValueError("Truncated payload")

		if not json_text:
			raise ValueError("Empty message")

		data = orjson.loads(json_text)
		
		if not (isinstance(data, dict) and "$schemaRef" in data):
			raise ValueError("Missing $schemaRef")

		# Re-serialize, enforce deterministic key ordering
		return orjson.dumps(data, option=orjson.OPT_SORT_KEYS)




if __name__ == "__main__":
	async def main():
		async for _ in EDDNReceiver():
			print(_.decode("utf-8"))

	try:
		asyncio.run(main())
	except KeyboardInterrupt:
		pass
