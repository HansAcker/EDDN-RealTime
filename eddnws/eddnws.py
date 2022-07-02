import asyncio
import signal
import sys
import zlib
import simplejson
import websockets
import zmq.asyncio
from zmq.asyncio import Context


zmq_url = "tcp://eddn.edcd.io:9500"
srv_path = "/run/eddn/eddnws.sock"


wsconns = set()

zmq_ctx = Context.instance()
zmq_task = None

zmq_sub = zmq_ctx.socket(zmq.SUB)
zmq_sub.setsockopt(zmq.SUBSCRIBE, b"")
zmq_sub.setsockopt(zmq.RECONNECT_IVL_MAX, 60 * 1000)
zmq_sub.setsockopt(zmq.RCVTIMEO, 600 * 1000)


def zmq_connect():
	zmq_sub.connect(zmq_url)

def zmq_disconnect():
	zmq_sub.disconnect(zmq_url)

def zmq_reconnect():
	zmq_sub.disconnect(zmq_url)
	zmq_sub.connect(zmq_url)


async def relay_messages():
	while True:
		try:
			zmq_msg = await zmq_sub.recv()
		except Exception as e:
			print("\r\x1b[K", end="")
			print("receive error:", e, file=sys.stderr)
			# TODO: is that the right thing to do?
			#zmq_reconnect()
			continue

		event = {}
		message = {}

		try:
			event = simplejson.loads(zlib.decompress(zmq_msg))
		except Exception as e:
			print("\r\x1b[K", end="")
			print("decode error:", e, file=sys.stderr)
			continue

		if not event:
			print("\rno event\x1b[K")
			continue

		try:
			websockets.broadcast(wsconns, simplejson.dumps(event))
		except Exception as e:
			print("\r\x1b[K", end="")
			print("relay error:", e, file=sys.stderr)

		try:
			message = event["message"]
			print(f"\r{message['event']}: {message['StarSystem']}\x1b[K", end="")
		except Exception as e:
			if not "event" in message:
				#print(simplejson.dumps(event))
				pass
			else:
				#print(simplejson.dumps(event))
				print(f"\r{message['event']}\x1b[K", end="")


async def ws_handler(websocket):
	global zmq_task

	wsconns.add(websocket)
	print("\rconnect\x1b[K", len(wsconns))

	if zmq_task is None:
		print("connecting ZMQ")
		zmq_connect()
		zmq_task = asyncio.create_task(relay_messages())

	try:
		await websocket.wait_closed()
	finally:
		wsconns.remove(websocket)
		print("\rdisconnect\x1b[K", len(wsconns))

	if not wsconns and zmq_task:
		print("disconnecting ZMQ")
		zmq_task.cancel()
		zmq_task = None
		zmq_disconnect()


async def server():
	print("starting websocket server", file=sys.stderr)

	# Set the stop condition when receiving SIGTERM.
	loop = asyncio.get_running_loop()
	stop = loop.create_future()
	loop.add_signal_handler(signal.SIGTERM, stop.set_result, None)
	#loop.add_signal_handler(signal.SIGINT, stop.set_result, None)

	async with websockets.unix_serve(ws_handler, srv_path):
		await stop
		print("\r\x1b[K", end="")
		print("stopping websocket server", file=sys.stderr)

if __name__ == "__main__":
	asyncio.run(server())
