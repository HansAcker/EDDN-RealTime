"use strict";
import * as THREE from "/js/three.module.min.js";
import { OrbitControls } from "/js/orbitcontrols.min.js";

// +x in StarPos is -x on the canvas. TODO: todo

const expire = 120 * 1000;
//const expire = 86400 * 1000;

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
const ani = renderer.capabilities.getMaxAnisotropy();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 200000);
camera.position.fromArray([1000, 25000, -25000]);

const navLineMaterial = new THREE.LineBasicMaterial({color: 0xffff00, linewidth: 10});
let navLines = [];

const eventTypes = {
	"FSDJump": {
		geometry: new THREE.SphereGeometry(100),
		material: new THREE.MeshBasicMaterial({color: 0xff0000, transparent: true, opacity: 0.25}),
		expire: 3600 * 1000
	},
	"Scan": {
		geometry: new THREE.SphereGeometry(100),
		material: new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.4})
	},
	"FSSDiscoveryScan": {
		geometry: new THREE.SphereGeometry(100),
		material: new THREE.MeshBasicMaterial({color: 0xffff00, transparent: true, opacity: 0.4}),
		expire: 30 * 1000
	},
	"default": {
		geometry: new THREE.SphereGeometry(100),
		material: new THREE.MeshBasicMaterial({color: 0x0000ff, transparent: true, opacity: 0.4})
	}
};

let navPings = {};

/*
const starGeometry = new THREE.SphereGeometry(1000);
const starMaterial = new THREE.MeshBasicMaterial({color: 0xffff00, transparent: true, opacity: 0.4});

const stars = [];

// Sol
stars["Sol"] = new THREE.Mesh(starGeometry, starMaterial);
scene.add(stars["Sol"]);

// Sagittarius A*
stars["SagA"] = new THREE.Mesh(starGeometry, starMaterial);
stars["SagA"].position.fromArray([-25.21875, -20.90625, 25899.96875]);
scene.add(stars["SagA"]);
*/

const controls = new OrbitControls(camera, renderer.domElement);
controls.zoomSpeed = 2.0;
controls.rotateSpeed = 2.0;
//controls.autoRotate = true;
//controls.enableDamping = true;

const galMaterial = new THREE.MeshBasicMaterial({
	map: new THREE.TextureLoader().load("/img/galmap4500.webp", render),
	side: THREE.DoubleSide,
	depthTest: false,
	depthWrite: false,
	transparent: true,
	opacity: 0.5
});

// TODO: proper dimensions
const galPlane = new THREE.Mesh(new THREE.PlaneGeometry(93300, 93300), galMaterial);

// Sagittarius A*
galPlane.position.fromArray([-25.21875, -20.90625, 25899.96875]);
// flip and rotate
galPlane.rotateX(-Math.PI/2);
galPlane.rotateZ(Math.PI);
scene.add(galPlane);

window.addEventListener("resize", onWindowResize);
document.body.appendChild(renderer.domElement);
//render();

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

function render() {
	requestAnimationFrame(render);

	const now = Date.now();
	let modified = false;

	for (const navLine of navLines) {
		if (now - navLine.ts > expire) {
			scene.remove(navLine.line);
			modified = true;
			navLine.ts = 0;
		}
	}

	if (modified) {
		navLines = navLines.filter((navLine) => navLine.ts != 0);
	}

	for (const StarSystem in navPings) {
		if (now > navPings[StarSystem].expirets) {
			scene.remove(navPings[StarSystem].ping);
			delete navPings[StarSystem];
		}
	}

	controls.update();
	renderer.render(scene, camera);
}

function PingMap(StarPos, StarSystem, type) {
	const expirets = Date.now() + (type in eventTypes && eventTypes[type].expire ? eventTypes[type].expire : expire);

	if (`${StarSystem}_${type}` in navPings) {
		navPings[`${StarSystem}_${type}`].expirets = expirets;
		return;
	}

	const ping = new THREE.Mesh(type in eventTypes ? eventTypes[type].geometry : eventTypes["default"].geometry,
		type in eventTypes ? eventTypes[type].material : eventTypes["default"].material);
	ping.position.fromArray([-StarPos[0], StarPos[1], StarPos[2]]);

	navPings[`${StarSystem}_${type}`] = {ping, expirets};
	scene.add(ping);
}

function NavRoute(route) {
	const points = [];

	for (const wp of route) {
		points.push(new THREE.Vector3().fromArray([-wp.StarPos[0], wp.StarPos[1], wp.StarPos[2]]));
	}

	const geometry = new THREE.BufferGeometry().setFromPoints(points);
	const line = new THREE.Line(geometry, navLineMaterial);

	navLines.push({line, ts: Date.now()});
	scene.add(line);
}

export { PingMap, NavRoute };
