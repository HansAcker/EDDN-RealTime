## Frontend TODO: possibly...
- extend Dashboard component
  - save/load/share layout, config, dynamic imports
- interactive config overlay
- add a "loading" indicator / messages
- revert the dynamic template fetch, integrate them back into index.html?
  - message details are mostly in English, anyway
- use complete row/cell templates, assign slots for data
- rework DataTable modules so that DOM element are only created during #render()
  - extract/format when messages arrive
  - create actual DOM nodes only when needed
- rework DataTable modules to re-use a pool of DOM nodes
- listen to visibilitychange events and start/stop/sync page updates
- test/complete the optional AbortController signal logic
- non-table modules: (2D) map, graphs
- optional EDDNClient SharedWorker where available
  - shared websocket/parsing between multiple tabs
  - filter per tab
- rework StatsBox


## Websocket server TODO: possibly...
- type-safe constructor args instead of **kwargs
- rework for websockets >=14
  - ws_handler() should cope with the argument type change (DeprecationWarning), could be adapted for type-checking
  - process_request() needs to be changed - support both with version switch?
  - the text=True argument to send() would allow a custom broadcast function
    - pass bytes from orjson.dumps() without .decode().encode() overhead
    - that would also give direct control over slow client buffers without the monitor task
- handle/discard incoming client messages
  - the current client should not send anything and would just get itself disconnected for missing pongs
- re-think monitor_task lifecycle
  - is monitoring the write buffer actually needed? missing pongs would disconnect a stalled client soon
- possibly use Event or similar to implement the lazy disconnect?
- use SO_REUSEPORT on websocket to attach multiple script instances to the same port
- InterpreterPoolExecutor could be better suited to offload JSON, requires python >=3.14
- run a profiler to find the actual hot spots
- continue to ignore signal handler incompatibility with native Windows, the script runs under WSL
- keep compatibility with python 3.8 for now
- review LLM-generated docstrings
