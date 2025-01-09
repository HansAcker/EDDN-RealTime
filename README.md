## EDDN RealTime Feed

### Live Events from the [Elite Dangerous Data Network](https://github.com/EDCD/EDDN)

Travel journals, discovery logs and market information transmitted by players
into a central data feed to update [star maps](https://edsm.net/),
[prices](https://inara.cz/elite/commodities-list/),
[route plotters](https://spansh.co.uk/plotter) and more.

This is a live monitoring board for that data.

https://eddn-realtime.space/


### Deploy to GitHub Pages

- Fork the repository
- under ``Settings -> Pages`` set ``Source`` to ``GitHub Actions``
- Go to ``Actions`` and enable Actions
- Select ``Deploy static content to Pages``, run workflow
- If successful, open https://\<yourname\>.github.io/EDDN-RealTime/


### How to edit locally

Javascript modules cannot load from file:// URLs, so you need a webserver for
the html directory. One simple way is to use Python's HTTP server module:

```
git clone https://github.com/HansAcker/EDDN-RealTime
cd EDDN-RealTime/html
python3 -m http.server
```

Then point your browser to http:\//127.0.0.1:8000/. You can edit the files
locally while the data websocket still connects to the server at
eddn-realtime.space.


To run the websocket service, it is easy to set up a local environment to
install the required packages:

```
cd EDDN-RealTime/eddnws
python3 -m venv venv  ## alternative: virtualenv venv
. venv/bin/activate
pip install -r requirements.txt 
python3 ./eddnws.py -v
```

Then just change the `socketUrl` option in the index.html to
`ws://127.0.0.1:8081`.


> Tested on Windows 10 (Ubuntu WSL)
