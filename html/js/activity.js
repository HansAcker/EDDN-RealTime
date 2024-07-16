// activity status icon

// TODO: depends on global "icon"

const states = {
	ok: Symbol("ok"),
	off: Symbol("off"),
	idle: Symbol("idle"),
	error: Symbol("error")
};

// can't use CSS to style the page icon href
// TODO: move to configuration block
const icons = {
	[states.ok]: "img/led/led-circle-green.svg",
	[states.off]: "img/led/led-circle-red.svg",
	[states.idle]: "img/led/led-circle-grey.svg",
	[states.error]: "img/led/led-circle-yellow.svg"
};

let idleTimer = null;
let lastState = states.off;

function set(state, timeout = 0) {
	if (idleTimer) {
		clearTimeout(idleTimer);
		idleTimer = null;
	}

	if (lastState != state) {
		console.log(`${lastState.toString()} => ${state.toString()}`);
		icon.href = icons[state];
		lastState = state;
	}

	if (timeout) {
		idleTimer = setTimeout(idle, timeout);
	}
}

const off = set.bind(null, states.off, 0);
const idle = set.bind(null, states.idle, 0);
const error = set.bind(null, states.error, 0);

function ok(timeout = 0) {
	set(states.ok, timeout);
}

export { ok, off, idle, error };
