import asyncio
import zlib
import simplejson
import websockets
import zmq.asyncio
from zmq.asyncio import Context


eddn_url = "tcp://eddn.edcd.io:9500"
srv_path = "/run/eddn/eddnws.sock"


wsconns = set()

zmq_ctx = Context.instance()
zmq_connected = False

zmq_sub = zmq_ctx.socket(zmq.SUB)
zmq_sub.setsockopt(zmq.SUBSCRIBE, b"")
zmq_sub.setsockopt(zmq.RECONNECT_IVL_MAX, 60 * 1000)
zmq_sub.setsockopt(zmq.RCVTIMEO, 600 * 1000)


def zmq_connect():
	global zmq_connected
	zmq_sub.connect(eddn_url)
	zmq_connected = True

def zmq_disconnect():
	global zmq_connected
	zmq_sub.disconnect(eddn_url)
	zmq_connected = False

def zmq_reconnect():
	zmq_sub.disconnect(eddn_url)
	zmq_sub.connect(eddn_url)


async def ws_handler(websocket, path):
	wsconns.add(websocket)
	print("\rconnect\x1b[K", len(wsconns))

	if not zmq_connected:
		print("connecting ZMQ")
		zmq_connect()

	try:
		await websocket.wait_closed()
	finally:
		wsconns.remove(websocket)
		print("\rdisconnect\x1b[K", len(wsconns))

	if not wsconns and zmq_connected:
		print("disconnecting ZMQ")
		zmq_disconnect()


async def relay_messages():
	while True:
		try:
			# TODO: wait for clients. runs into EAGAIN when !zmq_connected
			zmq_msg = await zmq_sub.recv()
		except Exception as e:
			print("\rreceive error:\x1b[K", e)
			if zmq_connected:
				zmq_reconnect()
			continue

		if zmq_msg == False:
			print("\runhandled zmq_msg")
			continue

		event = {}
		message = {}

		try:
			event = simplejson.loads(zlib.decompress(zmq_msg))
		except Exception as e:
			print("\rdecode error:\x1b[K", e)
			continue

		if not event:
			print("\rno event")
			continue

		try:
			websockets.broadcast(wsconns, simplejson.dumps(event))
		except Exception as e:
			print("\rrelay error:\x1b[K", e)

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


async def main():
	async with websockets.unix_serve(ws_handler, srv_path):
		await relay_messages()

if __name__ == "__main__":
    asyncio.run(main())
