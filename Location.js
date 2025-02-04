import { DEGREES, RADIANS, MODULO, SQUARE, ROUND, JULIAN_DATE } from './HelperFunctions.js';
// import * as THREE from 'https://cdn.skypack.dev/three@0.134.0/build/three.module.js';
import * as THREE from 'three';

let NAME = '[name not defined]';
let TYPE = '[type not defined]';
let PARENT = null;
let PARENT_STAR = null;
let COORDINATES = {
	'x' : null,
	'y' : null,
	'z' : null
};
let COORDINATES_3DMAP = {
	'x' : null,
	'y' : null,
	'z' : null
}

let THEME_COLOR = {
	'r' : null,
	'g' : null,
	'b' : null
};
let THEME_IMAGE = null;

// CALCULATED
let LATITUDE = null;
let LONGITUDE = null;
let LONGITUDE_360 = null;
let ELEVATION = null;
let ELEVATION_IN_DEGREES = null;
let STARRISE_AND_STARSET_ANGLE = null;

export default class Location {
	constructor(name, type, parentBody, parentStar, coordinates, themeColor = null, themeImage = null) {
		this.NAME = name;
		this.TYPE = type;
		this.PARENT = parentBody;
		this.PARENT_STAR = parentStar;
		this.COORDINATES = coordinates;

		this.THEME_COLOR = themeColor ? themeColor : this.PARENT.THEME_COLOR;
		this.THEME_IMAGE = (themeImage === '' || themeImage === null) ? this.PARENT.THEME_IMAGE : themeImage;

		// CALCULATED PROPERTIES
		// LATITUDE
		let lat2 = Math.sqrt( SQUARE(this.COORDINATES.x) + SQUARE(this.COORDINATES.y) );
		let lat1 = Math.atan2( this.COORDINATES.z, lat2 );
		this.LATITUDE = DEGREES(lat1);

		// LONGITUDE
		if (Math.abs(latitude) === 90) { 
			this.LONGITUDE = 0;
		
		} else {
			const atan2 = Math.atan2( this.COORDINATES.y, this.COORDINATES.x );
			const condition = DEGREES(MODULO(atan2, 2 * Math.PI));

			if( condition > 180 ) {
				this.LONGITUDE = -( 360 - condition );
			} else {
				this.LONGITUDE = condition;
			}
		}

		// LONGITUDE 360
		if (Math.abs(this.LATITUDE) === 90) {
			this.LONGITUDE_360 = 0;

		} else {
			const x = this.COORDINATES.x;
			const y = this.COORDINATES.y;

			const p2 = Math.atan2(y, x);
			const p1 = MODULO(p2, 2 * Math.PI);

			this.LONGITUDE_360 = DEGREES(p1);
		}

		// ELEVATION
		this.ELEVATION = Math.sqrt(SQUARE(this.COORDINATES.x) + SQUARE(this.COORDINATES.y) + SQUARE(this.COORDINATES.z)) - this.PARENT.BODY_RADIUS;

		// ELEVATION IN DEGREES
		let radius = this.PARENT.BODY_RADIUS;
		let height = this.ELEVATION;
		let p3 = height < 0 ? 0 : height;
		let p2 = radius + p3;
		let p1 = Math.acos( radius / p2 );
		this.ELEVATION_IN_DEGREES = DEGREES(p1);

		// STAR RISE/SET ANGLE
		let p4 = Math.tan( RADIANS(this.PARENT.DECLINATION(this.PARENT_STAR)) );
		p3 = Math.tan( RADIANS(this.LATITUDE) );
		p2 = -p3 * p4;
		p1 = Math.acos(p2); 
		this.STARRISE_AND_STARSET_ANGLE = DEGREES(p1) + this.PARENT.APPARENT_RADIUS(this.PARENT_STAR) + this.ELEVATION_IN_DEGREES;

		// NORMALIZED COORDINATES FOR 3D MAP
		let x = -coordinates.x / parentBody.BODY_RADIUS; // -x adjusts for rotation direction in 3D map
		let y = coordinates.y / parentBody.BODY_RADIUS;
		let z = coordinates.z / parentBody.BODY_RADIUS;
		const vec = new THREE.Vector3(x, y, z);

		if (vec.length() < 1) {
			// console.log(`${name} on ${parentBody.NAME} is inside geometry (Elevation: ${ROUND(this.ELEVATION * 1000)} m)`);
			vec.normalize();
			x = vec.x;
			y = vec.y;
			z = vec.z;
		}

		this.COORDINATES_3DMAP = {
			'x': x,
			'y': y,
			'z': z
		}

		// FINALIZATION
		window.LOCATIONS.push(this);
	}

	HOUR_ANGLE() {
		let cycleHourAngle = this.PARENT.HOUR_ANGLE();
		let longitude360 = this.LONGITUDE_360;
		let sMeridian = this.PARENT.MERIDIAN();

		let result = MODULO(cycleHourAngle - MODULO(longitude360 - sMeridian, 360), 360);
		return (result > 180) ? result - 360 : result;
	}

	STAR_MAX_ALTITUDE() {
		let coords = this.COORDINATES;
		let bs = this.PARENT.BS(this.PARENT_STAR);

		let rootCoord = Math.sqrt(SQUARE(coords.x) + SQUARE(coords.y) + SQUARE(coords.z));
		let rootBS = Math.sqrt(SQUARE(bs.x) + SQUARE(bs.y) + SQUARE(bs.z));
		
		let p5 = Math.sqrt(SQUARE(rootCoord) + SQUARE(rootBS) - (2 * rootCoord * rootBS * Math.cos(RADIANS(Math.abs(this.PARENT.DECLINATION(this.PARENT_STAR) - this.LATITUDE)))));
		let p4 = 2 * rootCoord * p5;
		let p3 = SQUARE(rootCoord) + SQUARE(p5) - SQUARE(rootBS);
		let p2 = p3 / p4;
		let p1 = Math.acos(p2);
		return DEGREES(p1) - 90;
	}

	STAR_ALTITUDE() {
		let p1 = RADIANS( Math.abs( this.HOUR_ANGLE() ) );
		return this.STAR_MAX_ALTITUDE() * Math.cos(p1);
	}

	STAR_AZIMUTH() {
		let lat = this.LATITUDE;
		let lon = this.LONGITUDE;
		let sDeclination = this.PARENT.DECLINATION();
		let sLongitude = this.PARENT.LONGITUDE();

		let p4 = Math.sin(RADIANS(sLongitude - lon)) * Math.cos(RADIANS(sDeclination));
		let p3 = Math.cos(RADIANS(lat)) * Math.sin(RADIANS(sDeclination)) - Math.sin(RADIANS(lat)) * Math.cos(RADIANS(sDeclination)) * Math.cos(RADIANS(sLongitude - lon));

		let p2 = Math.atan2(p4, p3);
		let p1 = DEGREES(p2);
		return MODULO(p1 + 360, 360);
	}

	get LENGTH_OF_DAYLIGHT() {
		let terrainRise = 0; // TODO: NOT IMPLEMENTED, PUT INTO CONSTRUCTOR
		let terrainSet = 0; // TODO: NOT IMPLEMENTED, PUT INTO CONSTRUCTOR

		let p1 = 2 * this.STARRISE_AND_STARSET_ANGLE - terrainRise - terrainSet;
		return (p1 / this.PARENT.ANGULAR_ROTATION_RATE) * 3 / 4300;
	}

	get LOCAL_TIME() {
		let angle = 360 - (this.HOUR_ANGLE() + 180);
		let percent = angle / 360;
		return 86400 * percent;
	}

	get ILLUMINATION_STATUS() {

		if (this.PARENT.ROTATION_RATE === 0) {
			return (this.STAR_MAX_ALTITUDE() < 0) ? 'Permanent Night' : 'Permanent Day';

		} else if (this.LOCAL_STAR_RISE_TIME.toString() === 'NaN') {
			return (this.STAR_MAX_ALTITUDE() < 0) ? 'Polar Night' : 'Polar Day';

		} else {

			if (this.IS_STAR_RISING_NOW) return 'Starrise';
			if (this.IS_STAR_SETTING_NOW) return 'Starset';

			let rise = this.LOCAL_STAR_RISE_TIME * 86400;
			let set = this.LOCAL_STAR_SET_TIME * 86400;
			let noon = 43200;

			let t = this.LOCAL_TIME;

			if (t > 86400 - 300) {
				return 'Midnight';
			} else if (t > set + 1500) {
				return 'Night';
			} else if (t > set) {
				return 'Evening Twilight';
			} else if (t > set - 7200) {
				return 'Evening';
			} else if (t > noon + 600) {
				return 'Afternoon';
			} else if (t > noon - 600) {
				return 'Noon';
			} else if (t > noon - 3600) {
				return 'Late Morning';
			} else if (t > rise) {
				return 'Morning';
			} else if (t > rise - 1500) {
				return 'Morning Twilight';
			} else if (t > 300) {
				return 'Night';
			} else {
				return 'Midnight';
			}
		}
	}

	get NEXT_NOON() {
		let angle = this.HOUR_ANGLE();
		let rotation = this.PARENT.ANGULAR_ROTATION_RATE;
		let result = (angle > 0) ? angle : (360 + angle);
		return result / rotation / 1440;
	}

	get LOCAL_STAR_RISE_TIME() {
		const percent = 1 - (this.LENGTH_OF_DAYLIGHT / this.PARENT.LENGTH_OF_DAY());
		const half = percent / 2;
		return half;
	}

	get LOCAL_STAR_SET_TIME() {
		const percent = 1 - (this.LENGTH_OF_DAYLIGHT / this.PARENT.LENGTH_OF_DAY());
		const half = percent / 2;
		return 1 - half;
	}

	get NEXT_STAR_RISE() {
		let riseSet = this.STARRISE_AND_STARSET_ANGLE;
		let rotation = this.PARENT.ANGULAR_ROTATION_RATE;
		let terrainRise = 0; // TODO: NOT IMPLEMENTED, PUT INTO CONSTRUCTOR

		let partialResult = this.NEXT_NOON - ((riseSet - terrainRise) / rotation * 3 / 4300);

		if (isNaN(partialResult)) return null;

		if (this.HOUR_ANGLE() > (riseSet - terrainRise)) {
			return partialResult;

		} else {

			if (this.HOUR_ANGLE() > 0) {
				return partialResult + this.PARENT.LENGTH_OF_DAY();

			} else {
				return partialResult;
			}

		}
	}

	get IS_STAR_RISING_NOW() {
		let padding = 90;

		if (
			this.NEXT_STAR_RISE * 86400 < padding ||
			this.NEXT_STAR_RISE * 86400 > (this.PARENT.LENGTH_OF_DAY() * 86400) - padding
		) {
			return true;
		} else {
			return false;
		}
	}

	get NEXT_STAR_SET() {
		let riseSet = this.STARRISE_AND_STARSET_ANGLE;
		let rotation = this.PARENT.ANGULAR_ROTATION_RATE;
		let terrainSet = 0; // TODO: NOT IMPLEMENTED, PUT INTO CONSTRUCTOR

		let partialResult = this.NEXT_NOON + ((riseSet - terrainSet) / rotation * 3 / 4300);

		if (isNaN(partialResult)) return null;
		
		if (this.HOUR_ANGLE() > -(riseSet - terrainSet)) {

			if (this.HOUR_ANGLE() > 0) {
				return partialResult;

			} else {
				return partialResult - this.PARENT.LENGTH_OF_DAY();
			}
			
		} else {
			return partialResult;
		}
	}

	get IS_STAR_SETTING_NOW() {
		let padding = 90;

		if (
			this.NEXT_STAR_SET * 86400 < padding ||
			this.NEXT_STAR_SET * 86400 > (this.PARENT.LENGTH_OF_DAY() * 86400) - padding
		) {
			return true;
		} else {
			return false;
		}
	}
}