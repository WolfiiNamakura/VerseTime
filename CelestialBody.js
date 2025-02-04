import { DEGREES, RADIANS, MODULO, SQUARE, ROUND, JULIAN_DATE } from './HelperFunctions.js';

let NAME = '[name not defined]';
let TYPE = '[type not defined]';
let PARENT = null;
let PARENT_STAR = null;
let COORDINATES = {
	'x' : null,
	'y' : null,
	'z' : null
};
let ROTATION_QUATERNION = {
	'w' : null,
	'x' : null,
	'y' : null,
	'z' : null
};
let BODY_RADIUS = null;
let ROTATION_RATE = null;
let ROTATION_CORRECTION = null;
let ORBITAL_ANGLE = null;
let ORBITAL_RADIUS = null;

let THEME_COLOR = {
	'r' : null,
	'g' : null,
	'b' : null
};
let THEME_IMAGE = '';

let RING = null;

let ANGULAR_ROTATION_RATE = null;

export default class CelestialBody {
	constructor(name, type, parentBody, parentStar, coordinates, rotationQuaternion, bodyRadius, rotationRate, rotationCorrection, orbitalAngle, orbitalRadius, themeColor = null, themeImage = null) {
		this.NAME = name;
		this.TYPE = type;
		this.PARENT = parentBody;
		this.PARENT_STAR = parentStar;
		this.COORDINATES = coordinates;
		this.ROTATION_QUATERNION = rotationQuaternion;
		this.BODY_RADIUS = bodyRadius;
		this.ROTATION_RATE = rotationRate;
		this.ANGULAR_ROTATION_RATE = 6 / this.ROTATION_RATE;
		this.ROTATION_CORRECTION = rotationCorrection;
		this.ORBITAL_ANGLE = orbitalAngle;
		this.ORBITAL_RADIUS = orbitalRadius;
		this.THEME_COLOR = themeColor ? themeColor : {'r' : null, 'g' : null, 'b' : null};
		this.THEME_IMAGE = themeImage;

		window.BODIES.push(this);
	}

	BS_INTERNAL(direction, distantObject) {
		if (
			direction !== 'x' &&
			direction !== 'y' &&
			direction !== 'z'
		) {
			throw 'Wrong direction value passed to function: ' + direction;
			return null;
		}

		let qw = this.ROTATION_QUATERNION.w;
		let qx = this.ROTATION_QUATERNION.x;
		let qy = this.ROTATION_QUATERNION.y;
		let qz = this.ROTATION_QUATERNION.z;

		let sx = distantObject.COORDINATES.x;
		let sy = distantObject.COORDINATES.y;
		let sz = distantObject.COORDINATES.z;

		let bx = this.COORDINATES.x;
		let by = this.COORDINATES.y;
		let bz = this.COORDINATES.z;

		let part1, part2, part3;

		if (direction === 'x') {
			part1 = ((1-(2*SQUARE(qy))-(2*SQUARE(qz)))*(sx-bx));
			part2 = (((2*qx*qy)-(2*qz*qw))*(sy-by));
			part3 = (((2*qx*qz)+(2*qy*qw))*(sz-bz));
		
		} else if (direction === 'y') {
			part1 = ( (2 * qx * qy) + (2 * qz * qw) ) * (sx - bx);
			part2 = (1 - (2 * SQUARE(qx)) - (2 * SQUARE(qz))) * (sy - by);
			part3 = ( (2 * qy * qz) - (2 * qx * qw) ) * (sz - bz);

		} else if (direction === 'z') {
			part1 = (((2*qx*qz)-(2*qy*qw))*(sx-bx));
			part2 = (((2*qy*qz)+(2*qx*qw))*(sy-by));
			part3 = ((1-(2*SQUARE(qx))-(2*SQUARE(qy)))*(sz-bz));
		}

		let result = part1 + part2 + part3;
		return result;
	}

	BS(distantObject) {
		// Convert from heliocentric coordinates to local coordinates centered on celestial object
		// "distantObject" is the celestial object that sits at the 0,0,0 origin point (usually the system's star)
		// returns 
		let x = this.BS_INTERNAL('x', distantObject);
		let y = this.BS_INTERNAL('y', distantObject);
		let z = this.BS_INTERNAL('z', distantObject);

		return {'x': x, 'y': y, 'z': z};
	}
	

	DECLINATION(distantObject = this.PARENT_STAR) {
		let bs = this.BS(distantObject);

		let chunk1 = Math.sqrt( SQUARE(bs.x) + SQUARE(bs.y) + SQUARE(bs.z) );
		chunk1 = Math.pow(chunk1, 2);

		let chunk2 = Math.sqrt( SQUARE(bs.x) + SQUARE(bs.y) );
		chunk2 = Math.pow(chunk2, 2);

		let part1 = chunk1 + chunk2 - SQUARE(bs.z);

		let chunk3 = Math.sqrt( SQUARE(bs.x) + SQUARE(bs.y) + SQUARE(bs.z) );
		let chunk4 = Math.sqrt( SQUARE(bs.x) + SQUARE(bs.y) );

		let part2 = 2 * chunk3 * chunk4;

		let result = Math.acos(part1 / part2);
		return Math.abs(DEGREES(result));
	}

	APPARENT_RADIUS(distantObject) {
		let radius = distantObject.BODY_RADIUS;
		let bs = this.BS(distantObject);

		let p4 = SQUARE(bs.x) + SQUARE(bs.y) + SQUARE(bs.z);
		let p3 = Math.sqrt(p4);
		let p2 = radius / p3;
		let p1 = Math.asin(p2);
		return DEGREES(p1);
	}

	LENGTH_OF_DAY() {
		return 3600 * this.ROTATION_RATE / 86400;
	}

	CURRENT_CYCLE() {
		// How many times the object has rotated since the 2020 reference date
		let julian = JULIAN_DATE();
		let dayLength = this.LENGTH_OF_DAY();
		return julian / dayLength;
	}

	HOUR_ANGLE() {
		// Current Rotation
		let cycle = this.CURRENT_CYCLE();
		if (cycle === Infinity) cycle = 0;

		let correction = this.ROTATION_CORRECTION;
		let result = MODULO((360 - MODULO(cycle, 1) * 360 - correction), 360)
		return result;
	}

	MERIDIAN(distantObject = this.PARENT_STAR) {
		// Position of distantObject if this celestial object didn't rotate
		let bs = this.BS(distantObject);

		let p2 = Math.atan2(bs.y, bs.x) - (Math.PI / 2);
		let p1 = MODULO(p2, 2 * Math.PI);
		return DEGREES(p1);
	}

	LONGITUDE(distantObject = this.PARENT_STAR) {
		const meridModulo = MODULO(0 - this.MERIDIAN(distantObject), 360);
		const cycleHourAngle = this.HOUR_ANGLE();

		let condition = cycleHourAngle - meridModulo;
		if (condition > 180) {
			return cycleHourAngle - meridModulo - 360;

		} else {
			const subtotal = cycleHourAngle - meridModulo;

			if (subtotal < -180) {
				return subtotal + 360;

			} else {
				return subtotal;
			}
		}

	}
}