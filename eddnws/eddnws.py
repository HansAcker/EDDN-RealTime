import argparse
import asyncio
import dataclasses
import logging
import os
import signal
import socket

from functools import partial
from typing import Any, Dict, Optional, Type

from eddnreceiver import EDDNReceiver
from websocketrelay import WebsocketRelay


def parse_args() -> Dict[str, Any]:
	parser = argparse.ArgumentParser(
				description="Relay EDDN messages to websocket clients",
				epilog="https://github.com/HansAcker/EDDN-RealTime",
				argument_default=argparse.SUPPRESS)

	receiver_defaults = EDDNReceiver.Options()
	relay_defaults = WebsocketRelay.Options()

	parser.add_argument("-v", "--verbose", action="count", dest="verbosity", help="Increase log level (default: WARNING, -v: INFO, -vv: DEBUG)")
	parser.add_argument('--systemd', action='store_true', dest="systemd", help="Enable socket activation if LISTEN_PID and LISTEN_FDS are set (default: False)")

	parser.add_argument("--ping-path", metavar="PATH", dest="ping_path", help=f"respond to health-checks if set (default: {relay_defaults.ping_path})")

	group = parser.add_argument_group("ZMQ options")
	group.add_argument("-u", "--url", metavar="URL", dest="zmq_url", help=f"EDDN ZMQ URL (default: {receiver_defaults.zmq_url})")
	group.add_argument("-d", "--zmq-close-delay", metavar="SECONDS", dest="close_delay", type=float, help=f"delay closing ZMQ connection after the last websocket client leaves (default: {relay_defaults.close_delay})")

	group.add_argument("--size-limit", metavar="BYTES", dest="msg_size_limit", type=int, help=f"set decompressed JSON size limit (default: {receiver_defaults.msg_size_limit})")
	group.add_argument("--zmq-HEARTBEAT_IVL", metavar="SECONDS", dest="zmq_HEARTBEAT_IVL", type=float, help=f"set ZMQ ping interval, 0 to disable (default: {receiver_defaults.zmq_HEARTBEAT_IVL})")
	group.add_argument("--zmq-HEARTBEAT_TIMEOUT", metavar="SECONDS", dest="zmq_HEARTBEAT_TIMEOUT", type=float, help=f"set ZMQ ping timeout (default: {receiver_defaults.zmq_HEARTBEAT_TIMEOUT})")
	group.add_argument("--zmq-RECONNECT_IVL_MAX", metavar="SECONDS", dest="zmq_RECONNECT_IVL_MAX", type=float, help=f"set maximum reconnection interval (default: {receiver_defaults.zmq_RECONNECT_IVL_MAX})")
	group.add_argument("--zmq-RCVHWM", metavar="NUM", dest="zmq_RCVHWM", type=int, help=f"set ZMQ message backlog limit, 0 to disable (default: {receiver_defaults.zmq_RCVHWM})")

	group = parser.add_argument_group("Websocket options")
	group.add_argument("-s", "--socket", metavar="PATH", dest="listen_path", help=f"listen on Unix socket if set (default: {relay_defaults.listen_path})")
	group.add_argument("-a", "--addr", dest="listen_addr", help=f"listen on TCP address (default: {relay_defaults.listen_addr})")
	group.add_argument("-p", "--port", dest="listen_port", type=int, help=f"listen on TCP port (default: {relay_defaults.listen_port})")
	group.add_argument("--connection-limit", metavar="NUM", dest="connection_limit", type=int, help=f"set websocket connection count limit, 0 to disable (default: {relay_defaults.connection_limit})")
	group.add_argument("--client-buffer-limit", metavar="BYTES", dest="client_buffer_limit", type=int, help=f"set per-client write buffer limit, 0 to disable (default: {relay_defaults.client_buffer_limit})")
	group.add_argument("--client-check-interval", metavar="SECONDS", dest="client_check_interval", type=float, help=f"client write buffer check interval, 0 to disable (default: {relay_defaults.client_check_interval})")

	# TODO: add ws keepalive, timeouts, queue size/length

	return vars(parser.parse_args())


def get_systemd_socket() -> Optional[socket.socket]:
	"""
	Detects if the process is launched by systemd with socket activation.
	Returns a socket object wrapping the first passed file descriptor (FD 3).
	"""
	listen_pid = os.environ.get("LISTEN_PID")
	listen_fds = os.environ.get("LISTEN_FDS")

	if not listen_pid or not listen_fds:
		return None

	try:
		# Check if we are the intended recipient and have at least one socket
		if int(listen_pid) != os.getpid() or int(listen_fds) < 1:
			return None

		# FD 3 is SD_LISTEN_FDS_START in systemd
		# Passing fileno causes Python to auto-detect family/type/proto
		return socket.socket(fileno=3)
	except ValueError:
		return None


def _filter_options(target_cls: Type[Any], args: Dict[str, Any]) -> Dict[str, Any]:
	"""
	Extracts keys from `args` that match the fields of `target_cls`.
	"""
	valid_keys = {f.name for f in dataclasses.fields(target_cls)}
	return {k: v for k, v in args.items() if k in valid_keys}


async def start_server(args: Optional[Dict[str, Any]] = None) -> None:
	if args is None:
		args = {}

	# Filter arguments into specific configuration dicts
	server_args = _filter_options(WebsocketRelay.Options, args)
	receiver_args = _filter_options(EDDNReceiver.Options, args)

	sock = None
	if args.get("systemd", False):
		sock = get_systemd_socket()

	iter_factory = partial(EDDNReceiver, **receiver_args)
	websocket_server = WebsocketRelay(iter_factory, sock=sock, **server_args)

	loop = asyncio.get_running_loop()
	stop_future = loop.create_future()

	# stop server on these signals
	for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
		loop.add_signal_handler(sig, stop_future.set_result, sig.name)

	await websocket_server.serve(stop_future)


if __name__ == "__main__":
	# use uvloop if available
	try:
		import uvloop
		uvloop.install()
	except ImportError:
		pass

	args = parse_args()

	# Log Level: WARNING(30) - (verbosity * 10). Clamped at DEBUG(10).
	verbosity = args.get("verbosity", 0)
	log_level = max(logging.DEBUG, logging.WARNING - (verbosity * 10))

	# configure global logger
	logging.basicConfig(format="%(levelname)s: %(message)s - %(module)s.%(funcName)s()", level=log_level)

	# Only enable websockets/asyncio logs in DEBUG mode
	if log_level > logging.DEBUG:
		logging.getLogger("websockets").setLevel(logging.WARNING)
		logging.getLogger("asyncio").setLevel(logging.WARNING)
	else:
		logging.getLogger("websockets").setLevel(logging.DEBUG)
		logging.getLogger("asyncio").setLevel(logging.DEBUG)

	asyncio.run(start_server(args))
