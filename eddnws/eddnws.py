import asyncio
import zlib
import simplejson
import websockets
import zmq.asyncio
from zmq.asyncio import Context

class ZMQReceiver:
	def __init__(self, wsconns, url="tcp://eddn.edcd.io:9500"):
		self.wsconns = wsconns
		self.url = url
		self.ctx = Context.instance()
		self.stopNow = False
		self.sub = None

	def start(self):
		asyncio.ensure_future(self.relay_msgs())

	def stop(self):
		self.stopNow = True

	def connect(self):
		self.sub = self.ctx.socket(zmq.SUB)
		self.sub.setsockopt(zmq.SUBSCRIBE, b"")
		self.sub.setsockopt(zmq.RECONNECT_IVL_MAX, 60 * 1000)
		self.sub.setsockopt(zmq.RCVTIMEO, 600 * 1000)
		self.sub.connect(self.url)

	def disconnect(self):
		self.sub.disconnect(self.url)

	def reconnect(self):
		self.sub.disconnect(self.url)
		self.sub.connect(self.url)

	async def relay_msgs(self):
		self.connect()

		while not self.stopNow:
			msg = await self.sub.recv()

			if msg == False:
				print("\r0mq timeout\x1b[K")
				self.reconnect()
				continue

			event = {}
			message = {}

			try:
				event = simplejson.loads(zlib.decompress(msg))
			except Exception as e:
				print("\rdecode error:\x1b[K", e)
				continue

			if not event:
				print("\rno event")
				continue

			try:
				websockets.broadcast(self.wsconns, simplejson.dumps(event))
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

		self.disconnect()

class WSServer:
	def __init__(self, path):
		self.wsconns = set()
		self.receiver = None
		self.path = path

	def start(self):
		# TODO: umask?
		asyncio.ensure_future(websockets.unix_serve(self.handler, self.path))

	async def handler(self, websocket, path):
		self.wsconns.add(websocket)
		print("\rconnect\x1b[K", len(self.wsconns))

		if self.receiver is None:
			self.receiver = ZMQReceiver(self.wsconns)
			self.receiver.start()

		try:
			await websocket.wait_closed()
		finally:
			self.wsconns.remove(websocket)
			print("\rdisconnect\x1b[K", len(self.wsconns))
			if not self.wsconns and self.receiver is not None:
				print("closing receiver")
				self.receiver.stop()
				self.receiver = None

if __name__ == "__main__":
	WSServer("/run/eddn/eddnws.sock").start()
	asyncio.get_event_loop().run_forever()
