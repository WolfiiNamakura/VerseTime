import * as THREE from 'https://cdn.skypack.dev/three@0.134.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/renderers/CSS2DRenderer.js';
import { CSS3DRenderer, CSS3DObject } from 'https://cdn.skypack.dev/three@0.134.0/examples/jsm/renderers/CSS3DRenderer.js';

import { DEGREES, RADIANS, MODULO, SQUARE, ROUND, JULIAN_DATE, POLAR_TO_CARTESIAN, RANDOM } from './HelperFunctions.js';

let scene, camera, renderer, labelRenderer, controls;
let mapDiv = document.getElementById('map-window');

let celestial3DEntity = null;
const omDistance = Math.sqrt(2);

init();
// createNewScene(window.ACTIVE_LOCATION.PARENT);
render();

window.addEventListener('resize', () => {
	renderer.setSize(window.innerWidth, window.innerHeight);
	labelRenderer.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
});

document.addEventListener('keydown', function(event){
	if (event.keyCode === 77) {
		createNewScene(window.ACTIVE_LOCATION.PARENT); 		
	}
});

document.getElementById('BUTTON-toggle-map-window').addEventListener('click', function(e) { 
	// createNewScene(window.ACTIVE_LOCATION.PARENT);

	let body = window.ACTIVE_LOCATION.PARENT;

	createNewScene(body);

	// Populate infobox data
	window.setText('map-info-type', body.TYPE);
	window.setText('map-info-system', body.PARENT_STAR.NAME);
	window.setText('map-info-orbits', body.PARENT.NAME);

	//let orbitDist = ROUND(body.ORBITAL_RADIUS / 149598000, 3); // AU
	window.setText('map-info-orbitdistance', ROUND(body.ORBITAL_RADIUS).toLocaleString());

	let radius = body.BODY_RADIUS.toLocaleString();
	window.setText('map-info-radius', radius);

	let circum = body.BODY_RADIUS * Math.PI;
	circum = ROUND(circum, 1);
	window.setText('map-info-circumference', circum.toLocaleString());

	let rot = body.ROTATION_RATE * 3600;
	rot = 360 / rot;
	window.setText('map-info-rotationrate', rot.toLocaleString());

	window.setText('map-info-lengthofday', window.HOURS_TO_TIME_STRING(body.ROTATION_RATE));

	let sats = window.BODIES.filter(bod => {
		if (!bod.PARENT) return false;

		if (bod.PARENT.NAME === body.NAME) {
			return true;
		} else {
			return false;
		}
	});
	window.setText('map-info-naturalsatellites', sats.length);
});

function init() {
	//console.debug('THREE.js revision: ' + THREE.REVISION);
	
	scene = new THREE.Scene();

	renderer = new THREE.WebGLRenderer({antialias: true});
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColor('#101016');

	labelRenderer = new CSS2DRenderer();
	labelRenderer.setSize( window.innerWidth, window.innerHeight );
	labelRenderer.domElement.style.position = 'absolute';
	labelRenderer.domElement.style.top = '0px';
	mapDiv.appendChild( labelRenderer.domElement );

	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
	camera.position.set(0, 20, 0);
	camera.lookAt(0, 0, 0);

	controls = new OrbitControls(camera, labelRenderer.domElement);
	controls.enablePan = false;
	controls.enableDamping = true;
	controls.dampingFactor = 0.03;
	controls.rotateSpeed = 0.5;
	controls.maxPolarAngle = Math.PI * 0.95;
	controls.minPolarAngle = Math.PI * 0.05;
	controls.smoothZoom = true;
	controls.zoomDampingFactor = 0.2;
	controls.smoothZoomSpeed = 5.0;
	controls.maxDistance = 10;
	controls.minDistance = 1.5;

	mapDiv.appendChild( renderer.domElement );
}

function render() {
	controls.update();
	renderer.render(scene, camera);
	labelRenderer.render(scene, camera);
	requestAnimationFrame(render);


	if (!showMapWindow) return;


	// LABEL OCCLUSION
	// Improve performance by doing it every 5th frame
	if (renderer.info.render.frame % 5 === 0) {
		let raycaster = new THREE.Raycaster();
		let v = new THREE.Vector3();
		let r = window.ACTIVE_LOCATION.PARENT.BODY_RADIUS;
		let bodyMesh = scene.getObjectByName('Celestial Object');

		//LOCATION LABELS
		let locationLabels = document.querySelectorAll('.mapLocationLabel');
		locationLabels.forEach(label => {
			let location = window.LOCATIONS.filter(loc => loc.NAME === label.dataset.location)[0];

			let coord = location.COORDINATES;
			let x = -coord.x / r; // adjust for rotation direction
			let y = coord.y / r;
			let z = coord.z / r;
			let pos = new THREE.Vector3(x, z, y); // Y = UP in THREE.JS

			v.copy(pos).sub(camera.position).normalize().multiply(new THREE.Vector3(-1, -1, -1));
			raycaster.set( pos, v );
			let intersects = raycaster.intersectObject(bodyMesh, false);
			label.dataset.occluded = (intersects.length > 0) ? true : false;
		});


		// ORBITAL MARKERS
		let orbitalMarkerCoordinates = [
			{ x:  0, y:  0,  z:  omDistance },
			{ x:  0, y:  0,  z: -omDistance },
			{ x:  0, y:  omDistance,  z:  0 },
			{ x:  0, y: -omDistance,  z:  0 },
			{ x: -omDistance, y:  0,  z:  0 },
			{ x:  omDistance, y:  0,  z:  0 },
		];

		let orbitalMarkerLabels = document.querySelectorAll('.mapOrbitalMarker');
		orbitalMarkerLabels.forEach(label => {
			let markerNumber = label.innerText.replace('OM', '');
			let coord = orbitalMarkerCoordinates[markerNumber - 1];
			let pos = new THREE.Vector3(coord.x, coord.z, coord.y); // Y = UP

			v.copy(pos).sub(camera.position).normalize().multiply(new THREE.Vector3(-1, -1, -1));
			raycaster.set( pos, v );
			let intersects = raycaster.intersectObject(bodyMesh, true);
			label.dataset.occluded = intersects.length > 0 ? true : false;
		});
	}


	// LOCATION TIMES
	let timeLabels = document.querySelectorAll('.mapLocationTime');
	timeLabels.forEach(label => {
		let location = window.LOCATIONS.filter(loc => loc.NAME === label.parentNode.dataset.location)[0];

		let s = location.ILLUMINATION_STATUS;
		if (s === 'Night' || s === 'Midnight' || s === 'Morning Twilight' || s === 'Evening Twilight' || s === 'Perma-Night') {
			label.classList.add('blue');
			label.classList.remove('yellow');
		} else {
			label.classList.remove('blue');
			label.classList.add('yellow');
		}

		let string = window.HOURS_TO_TIME_STRING(location.LOCAL_TIME / 60 / 60, false);
		if (string === 'NaN:NaN') string = location.ILLUMINATION_STATUS;
		
		window.setText(label, string);
	});
}



function createNewScene(celestialObject) {
	scene.clear();
	let oldLabels = document.querySelectorAll( '.mapLocationName, .mapLocationTime, .mapLocationIcon, .mapOrbitalMarker' );
	oldLabels.forEach(l => {l.remove()});

	let c = celestialObject.THEME_COLOR;
	document.getElementById('map-body-name').textContent = celestialObject.NAME;
	camera.position.set(2, 0.5, 2);

	createStarfield();
	createLatLonGrid(scene, c, 0.9925);
	createTexturedSphere(celestialObject, 0.995);

	createLocationLabels(celestialObject);
	createOrbitalMarkerLabels();
}



function setLocationIcon(type, element) {
	if (
		type === 'Underground bunker' ||
		type === 'Emergency shelter' ||
		type === 'Outpost' ||
		type === 'Prison' ||
		type === 'Shipwreck' ||
		type === 'Scrapyard' ||
		type === 'Settlement'
	) {
		element.classList.add('icon-outpost');
	
	} else if (
		type === 'Space station' ||
		type === 'Asteroid base'
	) {
		element.classList.add('icon-spacestation');
	
	} else if (type === 'Landing zone') {
		element.classList.add('icon-landingzone');
	
	} else {
		element.classList.add('icon-space');
	}
}

function makeLine(x1, y1, z1, x2, y2, z2, mat) {
	const p = [];
	p.push(new THREE.Vector3(x1, y1, z1));
	p.push(new THREE.Vector3(x2, y2, z2));
	const geo = new THREE.BufferGeometry().setFromPoints(p);
	const line = new THREE.Line(geo, mat);
	return line;
}

function createLatLonGrid(scene, color, scale = 0.99) {
	const material = new THREE.LineBasicMaterial( {
		color: `rgb(${color.r}, ${color.g}, ${color.b})`,
		transparent: true,
		opacity: 0.1
	});

	let grid = new THREE.Group();
	grid.name = 'Grid';

	for (let i = 0; i < 180; i += 30) {
		let circle = makeLongitudeCircle(i, material, scale);
		grid.add(circle);
	}

	for (let i = 15; i < 180; i += 15) {
		let circle = makeLatitudeCircle(i, material, scale);
		grid.add(circle);
	}

	scene.add(grid);
	grid.visible = document.getElementById('map-settings-show-grid').checked;
}

function makeLongitudeCircle(angle, material, scale) {
	const p = [];
	for (let i = 0; i <= 360; i += 360 / 96) {
		let rad = RADIANS(i);
		let x = 0;
		let y = Math.sin(rad) * scale;
		let z = Math.cos(rad) * scale;
		p.push(new THREE.Vector3(x, y, z));
	}

	const geo = new THREE.BufferGeometry().setFromPoints(p);
	const circle = new THREE.Line(geo, material);
	circle.rotation.y = RADIANS(angle);
	return circle;
}

function makeLatitudeCircle(angle, material, scale) {
	const p = [];

	for (let i = 0; i <= 360; i += 360 / 96) {
		let rad = RADIANS(i);
		let x = Math.cos(rad) * Math.sin(RADIANS(angle)) * scale;
		let y = Math.cos(RADIANS(angle)) * scale;
		let z = Math.sin(rad) * Math.sin(RADIANS(angle)) * scale;
		p.push(new THREE.Vector3(x, y, z));
	}

	const geo = new THREE.BufferGeometry().setFromPoints(p);
	const circle = new THREE.Line(geo, material);
	return circle;
}


function createDaySphere(celestialObject, scale = 1) {
	let c = celestialObject.THEME_COLOR;
	let geo = new THREE.SphereGeometry(scale, 48, 48);
	let mat = new THREE.MeshBasicMaterial({
		color: `rgb(${c.r}, ${c.g}, ${c.b})`,
		transparent: true,
		opacity: 0.15,
		depthWrite: false
	});

	let obj = new THREE.Mesh(geo, mat);
	obj.name = 'Celestial Object';
	scene.add(obj);
}

function createNightSphere(celestialObject) {
	// TESTING ONLY
	let c = celestialObject.THEME_COLOR;
	let geo = new THREE.SphereGeometry(1, 48, 48, 0, Math.PI);
	let mat = new THREE.MeshBasicMaterial({
		color: `rgb(20, 20, 20)`,
		transparent: true,
		opacity: 0.3
	});

	let obj = new THREE.Mesh(geo, mat);
	obj.rotation.y = RADIANS(celestialObject.MERIDIAN() + celestialObject.ROTATION_CORRECTION + 180);
	scene.add(obj);
}

function createTexturedSphere(celestialObject, scale = 1) {
	let textureOpacity = document.getElementById('map-settings-planet-transparency').value / 100;

	var loader = new THREE.TextureLoader();
	let file = 'static/assets/' + celestialObject.NAME.toLowerCase() + '.webp';
	loader.load(file, function ( texture ) {

		let geo = new THREE.SphereGeometry(scale, 72, 72, 0, Math.PI * 2);
		let mat = new THREE.MeshBasicMaterial({
			map: texture,
			transparent: true,
			opacity: textureOpacity
		});

		let obj = new THREE.Mesh(geo, mat);
		obj.name = 'Celestial Object';
		scene.add(obj);
		celestial3DEntity = obj;
	} );
}

function createStarfield(amount = 300) {
	let vertices = [];

	for (let i = 0; i < amount; i++) {
		let theta = RANDOM() * 2.0 * Math.PI;
		let phi = Math.acos(2.0 * RANDOM() - 1.0);
		let r = Math.cbrt(RANDOM()) * 1500;
		let c = POLAR_TO_CARTESIAN(DEGREES(theta), DEGREES(phi), r);
		vertices.push(c.x, c.z, c.y);
	}

	let stars = new THREE.BufferGeometry();
	stars.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

	let mat = new THREE.PointsMaterial({
		color: `rgb(255, 255, 255)`,
		size: 0.02,
		sizeAttenuation: true,
		transparent: true,
		opacity: 0.6
	});

	let mesh = new THREE.Points(stars, mat);
	scene.add(mesh);
	mesh.name = 'Starfield';
	mesh.visible = document.getElementById('map-settings-show-starfield').checked;
}

function createLocationLabels(celestialObject) {
	let r = celestialObject.BODY_RADIUS;
	let locations = window.LOCATIONS.filter(loc => loc.PARENT === celestialObject);

	for (let i = 0; i < locations.length; i++) {
		let pos = locations[i].COORDINATES;
		let x = -pos.x / r; // adjust for rotation direction
		let y = pos.y / r;
		let z = pos.z / r;

		let container = document.createElement('div');
		container.className = 'mapLocationLabel';
		container.dataset.location = locations[i].NAME;
		container.dataset.occluded = true;

		container.addEventListener('mouseenter', () => {
			showMapLocationData(locations[i], container);
		});

		container.addEventListener('mouseleave', hideMapLocationData);

		container.addEventListener('pointerdown', () => {
			setLocation(locations[i].NAME);
		});

		let name = document.createElement('p');
		container.append(name);
		name.className = 'mapLocationName';
		name.innerText = locations[i].NAME;

		let icon = document.createElement('div');
		container.append(icon);
		icon.className = 'mapLocationIcon';
		setLocationIcon(locations[i].TYPE, icon);

		let time = document.createElement('p');
		container.append(time);
		time.className = 'mapLocationTime';
		time.innerText = 'XX:XX';

		time.dataset.visible = document.getElementById('map-settings-show-times').checked;

		let locationLabel = new CSS2DObject(container);
		locationLabel.position.copy(new THREE.Vector3(x, z, y));
		scene.add(locationLabel);


	}
}

function createOrbitalMarkerLabels() {
	let orbitalMarkerCoordinates = [
		{ x:  0, y:  0,  z:  omDistance },
		{ x:  0, y:  0,  z: -omDistance },
		{ x:  0, y:  omDistance,  z:  0 },
		{ x:  0, y: -omDistance,  z:  0 },
		{ x: -omDistance, y:  0,  z:  0 },
		{ x:  omDistance, y:  0,  z:  0 },
	];

	let group = new THREE.Group();
	group.name = 'Orbital Markers';

	for (let i = 0; i < 6; i++) {
		let coords = orbitalMarkerCoordinates[i];
		let x = coords.x;
		let y = coords.y;
		let z = coords.z;

		let labelDiv = document.createElement('div');
		labelDiv.className = 'mapOrbitalMarker';
		labelDiv.textContent = `OM${i + 1}`;

		labelDiv.dataset.visible = document.getElementById('map-settings-show-orbitalmarkers').checked;

		let nameLabel = new CSS2DObject(labelDiv);
		let nameLabelPosition = new THREE.Vector3(x, z, y);
		nameLabel.position.copy(nameLabelPosition);
		group.add(nameLabel);
	}

	scene.add(group);
}

function createCelestialMarkers() {
	// for testing only right now
	const matRed = new THREE.LineBasicMaterial( {
		color: `rgb(255, 0, 0)`,
		transparent: true,
		opacity: 0.5
	});
	scene.add(makeLine(-3, 0, 0, 3, 0, 0, matRed));

	const matStarDirection = new THREE.LineBasicMaterial( {
		color: `rgb(255, 255, 0)`,
		transparent: true,
		opacity: 0.4
	});

	let m = RADIANS(celestialObject.MERIDIAN() - celestialObject.ROTATION_CORRECTION);
	let starDirection = makeLine(0, 0, 0, Math.cos(m)*2, 0, Math.sin(m)*2, matStarDirection);
	scene.add(starDirection);
}



// MAP SETTINGS
document.getElementById('map-settings-planet-transparency').addEventListener('change', function() {
	saveSetting('mapPlanetTransparency', document.getElementById('map-settings-planet-transparency').value);

	let opacityPercent = document.getElementById('map-settings-planet-transparency').value / 100;
	let mesh = scene.getObjectByName('Celestial Object');
	let texturePath = 'static/assets/' + window.ACTIVE_LOCATION.PARENT.NAME.toLowerCase() + '.webp';

	let loader = new THREE.TextureLoader();
	let newMaterial;
	loader.load(texturePath, function ( texture ) {
		newMaterial = new THREE.MeshBasicMaterial({
			map: texture,
			transparent: true,
			opacity: opacityPercent
		});

		mesh.material.dispose();
		mesh.material = newMaterial;
	} );
});

document.getElementById('map-settings-show-grid').addEventListener('change', function() {
	saveSetting('mapGrid', document.getElementById('map-settings-show-grid').checked);

	let object = scene.getObjectByName('Grid');
	object.visible = document.getElementById('map-settings-show-grid').checked;
});

document.getElementById('map-settings-show-orbitalmarkers').addEventListener('change', function() {
	saveSetting('mapOMs', document.getElementById('map-settings-show-orbitalmarkers').checked);

	let markers = document.querySelectorAll('.mapOrbitalMarker');
	markers.forEach(element => {
		element.dataset.visible = document.getElementById('map-settings-show-orbitalmarkers').checked;
	});
});

document.getElementById('map-settings-show-times').addEventListener('change', function() {
	saveSetting('mapTimes', document.getElementById('map-settings-show-times').checked);

	let labels = document.querySelectorAll('.mapLocationTime');
	labels.forEach(element => {
		element.dataset.visible = document.getElementById('map-settings-show-times').checked;
	});
});

document.getElementById('map-settings-show-starfield').addEventListener('change', function() {
	saveSetting('mapStars', document.getElementById('map-settings-show-starfield').checked);

	let object = scene.getObjectByName('Starfield');
	object.visible = document.getElementById('map-settings-show-starfield').checked;
});
