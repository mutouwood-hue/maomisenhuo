/* MIT Three.js r185 omitted classes; use exactly the existing bundled core. */
(function(root){const T=root.CatTownTHREE;if(!T)throw Error('TOWN_CORE_NOT_READY');const {BufferGeometry,Float32BufferAttribute,Vector3,Color,Light,LightShadow,PerspectiveCamera}=T;const warn=()=>{};

/**
 * A class for generating a sphere geometry.
 *
 * ```js
 * const geometry = new THREE.SphereGeometry( 15, 32, 16 );
 * const material = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
 * const sphere = new THREE.Mesh( geometry, material );
 * scene.add( sphere );
 * ```
 *
 * @augments BufferGeometry
 * @demo scenes/geometry-browser.html#SphereGeometry
 */
class SphereGeometry extends BufferGeometry {

	/**
	 * Constructs a new sphere geometry.
	 *
	 * @param {number} [radius=1] - The sphere radius.
	 * @param {number} [widthSegments=32] - The number of horizontal segments. Minimum value is `3`.
	 * @param {number} [heightSegments=16] - The number of vertical segments. Minimum value is `2`.
	 * @param {number} [phiStart=0] - The horizontal starting angle in radians.
	 * @param {number} [phiLength=Math.PI*2] - The horizontal sweep angle size.
	 * @param {number} [thetaStart=0] - The vertical starting angle in radians.
	 * @param {number} [thetaLength=Math.PI] - The vertical sweep angle size.
	 */
	constructor( radius = 1, widthSegments = 32, heightSegments = 16, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI ) {

		super();

		this.type = 'SphereGeometry';

		/**
		 * Holds the constructor parameters that have been
		 * used to generate the geometry. Any modification
		 * after instantiation does not change the geometry.
		 *
		 * @type {Object}
		 */
		this.parameters = {
			radius: radius,
			widthSegments: widthSegments,
			heightSegments: heightSegments,
			phiStart: phiStart,
			phiLength: phiLength,
			thetaStart: thetaStart,
			thetaLength: thetaLength
		};

		widthSegments = Math.max( 3, Math.floor( widthSegments ) );
		heightSegments = Math.max( 2, Math.floor( heightSegments ) );

		const thetaEnd = Math.min( thetaStart + thetaLength, Math.PI );

		let index = 0;
		const grid = [];

		const vertex = new Vector3();
		const normal = new Vector3();

		// buffers

		const indices = [];
		const vertices = [];
		const normals = [];
		const uvs = [];

		// generate vertices, normals and uvs

		for ( let iy = 0; iy <= heightSegments; iy ++ ) {

			const verticesRow = [];

			const v = iy / heightSegments;
			const theta = thetaStart + v * thetaLength;

			const y = radius * Math.cos( theta );
			const ringRadius = Math.sqrt( radius * radius - y * y );

			// special case for the poles

			let uOffset = 0;

			if ( iy === 0 && thetaStart === 0 ) {

				uOffset = 0.5 / widthSegments;

			} else if ( iy === heightSegments && thetaEnd === Math.PI ) {

				uOffset = - 0.5 / widthSegments;

			}

			for ( let ix = 0; ix <= widthSegments; ix ++ ) {

				const u = ix / widthSegments;
				const phi = phiStart + u * phiLength;

				// vertex

				vertex.x = - ringRadius * Math.cos( phi );
				vertex.y = y;
				vertex.z = ringRadius * Math.sin( phi );

				vertices.push( vertex.x, vertex.y, vertex.z );

				// normal

				normal.copy( vertex ).normalize();
				normals.push( normal.x, normal.y, normal.z );

				// uv

				uvs.push( u + uOffset, 1 - v );

				verticesRow.push( index ++ );

			}

			grid.push( verticesRow );

		}

		// indices

		for ( let iy = 0; iy < heightSegments; iy ++ ) {

			for ( let ix = 0; ix < widthSegments; ix ++ ) {

				const a = grid[ iy ][ ix + 1 ];
				const b = grid[ iy ][ ix ];
				const c = grid[ iy + 1 ][ ix ];
				const d = grid[ iy + 1 ][ ix + 1 ];

				if ( iy !== 0 || thetaStart > 0 ) indices.push( a, b, d );
				if ( iy !== heightSegments - 1 || thetaEnd < Math.PI ) indices.push( b, c, d );

			}

		}

		// build geometry

		this.setIndex( indices );
		this.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );
		this.setAttribute( 'normal', new Float32BufferAttribute( normals, 3 ) );
		this.setAttribute( 'uv', new Float32BufferAttribute( uvs, 2 ) );

	}

	copy( source ) {

		super.copy( source );

		this.parameters = Object.assign( {}, source.parameters );

		return this;

	}

	/**
	 * Factory method for creating an instance of this class from the given
	 * JSON object.
	 *
	 * @param {Object} data - A JSON object representing the serialized geometry.
	 * @return {SphereGeometry} A new instance.
	 */
	static fromJSON( data ) {

		return new SphereGeometry( data.radius, data.widthSegments, data.heightSegments, data.phiStart, data.phiLength, data.thetaStart, data.thetaLength );

	}

}



/**
 * This light globally illuminates all objects in the scene equally.
 *
 * It cannot be used to cast shadows as it does not have a direction.
 *
 * ```js
 * const light = new THREE.AmbientLight( 0x404040 ); // soft white light
 * scene.add( light );
 * ```
 *
 * @augments Light
 */
class AmbientLight extends Light {

	/**
	 * Constructs a new ambient light.
	 *
	 * @param {(number|Color|string)} [color=0xffffff] - The light's color.
	 * @param {number} [intensity=1] - The light's strength/intensity.
	 */
	constructor( color, intensity ) {

		super( color, intensity );

		/**
		 * This flag can be used for type testing.
		 *
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isAmbientLight = true;

		this.type = 'AmbientLight';

	}

}



/**
 * Represents the shadow configuration of point lights.
 *
 * @augments LightShadow
 */
class PointLightShadow extends LightShadow {

	/**
	 * Constructs a new point light shadow.
	 */
	constructor() {

		super( new PerspectiveCamera( 90, 1, 0.5, 500 ) );

		/**
		 * This flag can be used for type testing.
		 *
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isPointLightShadow = true;

	}

}



/**
 * A light that gets emitted from a single point in all directions. A common
 * use case for this is to replicate the light emitted from a bare
 * lightbulb.
 *
 * This light can cast shadows - see the {@link PointLightShadow} for details.
 *
 * ```js
 * const light = new THREE.PointLight( 0xff0000, 1, 100 );
 * light.position.set( 50, 50, 50 );
 * scene.add( light );
 * ```
 *
 * @augments Light
 */
class PointLight extends Light {

	/**
	 * Constructs a new point light.
	 *
	 * @param {(number|Color|string)} [color=0xffffff] - The light's color.
	 * @param {number} [intensity=1] - The light's strength/intensity measured in candela (cd).
	 * @param {number} [distance=0] - Maximum range of the light. `0` means no limit.
	 * @param {number} [decay=2] - The amount the light dims along the distance of the light.
	 */
	constructor( color, intensity, distance = 0, decay = 2 ) {

		super( color, intensity );

		/**
		 * This flag can be used for type testing.
		 *
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isPointLight = true;

		this.type = 'PointLight';

		/**
		 * When distance is zero, light will attenuate according to inverse-square
		 * law to infinite distance. When distance is non-zero, light will attenuate
		 * according to inverse-square law until near the distance cutoff, where it
		 * will then attenuate quickly and smoothly to 0. Inherently, cutoffs are not
		 * physically correct.
		 *
		 * @type {number}
		 * @default 0
		 */
		this.distance = distance;

		/**
		 * The amount the light dims along the distance of the light. In context of
		 * physically-correct rendering the default value should not be changed.
		 *
		 * @type {number}
		 * @default 2
		 */
		this.decay = decay;

		/**
		 * This property holds the light's shadow configuration.
		 *
		 * @type {PointLightShadow}
		 */
		this.shadow = new PointLightShadow();

	}

	/**
	 * The light's power. Power is the luminous power of the light measured in lumens (lm).
	 * Changing the power will also change the light's intensity.
	 *
	 * @type {number}
	 */
	get power() {

		// compute the light's luminous power (in lumens) from its intensity (in candela)
		// for an isotropic light source, luminous power (lm) = 4 π luminous intensity (cd)
		return this.intensity * 4 * Math.PI;

	}

	set power( power ) {

		// set the light's intensity (in candela) from the desired luminous power (in lumens)
		this.intensity = power / ( 4 * Math.PI );

	}

	dispose() {

		super.dispose();

		this.shadow.dispose();

	}

	copy( source, recursive ) {

		super.copy( source, recursive );

		this.distance = source.distance;
		this.decay = source.decay;

		this.shadow = source.shadow.clone();

		return this;

	}

	toJSON( meta ) {

		const data = super.toJSON( meta );

		data.object.distance = this.distance;
		data.object.decay = this.decay;

		data.object.shadow = this.shadow.toJSON();

		return data;

	}

}



/**
 * This class can be used to define an exponential squared fog,
 * which gives a clear view near the camera and a faster than exponentially
 * densening fog farther from the camera.
 *
 * ```js
 * const scene = new THREE.Scene();
 * scene.fog = new THREE.FogExp2( 0xcccccc, 0.002 );
 * ```
 */
class FogExp2 {

	/**
	 * Constructs a new fog.
	 *
	 * @param {number|Color} color - The fog's color.
	 * @param {number} [density=0.00025] - Defines how fast the fog will grow dense.
	 */
	constructor( color, density = 0.00025 ) {

		/**
		 * This flag can be used for type testing.
		 *
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isFogExp2 = true;

		/**
		 * The name of the fog.
		 *
		 * @type {string}
		 */
		this.name = '';

		/**
		 * The fog's color.
		 *
		 * @type {Color}
		 */
		this.color = new Color( color );

		/**
		 *  Defines how fast the fog will grow dense.
		 *
		 * @type {number}
		 * @default 0.00025
		 */
		this.density = density;

	}

	/**
	 * Returns a new fog with copied values from this instance.
	 *
	 * @return {FogExp2} A clone of this instance.
	 */
	clone() {

		return new FogExp2( this.color, this.density );

	}

	/**
	 * Serializes the fog into JSON.
	 *
	 * @param {?(Object|string)} meta - An optional value holding meta information about the serialization.
	 * @return {Object} A JSON object representing the serialized fog
	 */
	toJSON( /* meta */ ) {

		return {
			type: 'FogExp2',
			name: this.name,
			color: this.color.getHex(),
			density: this.density
		};

	}

}



/**
 * Class for keeping track of time.
 *
 * @deprecated since r183.
 */
class Clock {

	/**
	 * Constructs a new clock.
	 *
	 * @deprecated since 183.
	 * @param {boolean} [autoStart=true] - Whether to automatically start the clock when
	 * `getDelta()` is called for the first time.
	 */
	constructor( autoStart = true ) {

		/**
		 * If set to `true`, the clock starts automatically when `getDelta()` is called
		 * for the first time.
		 *
		 * @type {boolean}
		 * @default true
		 */
		this.autoStart = autoStart;

		/**
		 * Holds the time at which the clock's `start()` method was last called.
		 *
		 * @type {number}
		 * @default 0
		 */
		this.startTime = 0;

		/**
		 * Holds the time at which the clock's `start()`, `getElapsedTime()` or
		 * `getDelta()` methods were last called.
		 *
		 * @type {number}
		 * @default 0
		 */
		this.oldTime = 0;

		/**
		 * Keeps track of the total time that the clock has been running.
		 *
		 * @type {number}
		 * @default 0
		 */
		this.elapsedTime = 0;

		/**
		 * Whether the clock is running or not.
		 *
		 * @type {boolean}
		 * @default true
		 */
		this.running = false;

		warn( 'Clock: This module has been deprecated. Please use THREE.Timer instead.' ); // @deprecated, r183

	}

	/**
	 * Starts the clock. When `autoStart` is set to `true`, the method is automatically
	 * called by the class.
	 */
	start() {

		this.startTime = performance.now();

		this.oldTime = this.startTime;
		this.elapsedTime = 0;
		this.running = true;

	}

	/**
	 * Stops the clock.
	 */
	stop() {

		this.getElapsedTime();
		this.running = false;
		this.autoStart = false;

	}

	/**
	 * Returns the elapsed time in seconds.
	 *
	 * @return {number} The elapsed time.
	 */
	getElapsedTime() {

		this.getDelta();
		return this.elapsedTime;

	}

	/**
	 * Returns the delta time in seconds.
	 *
	 * @return {number} The delta time.
	 */
	getDelta() {

		let diff = 0;

		if ( this.autoStart && ! this.running ) {

			this.start();
			return 0;

		}

		if ( this.running ) {

			const newTime = performance.now();

			diff = ( newTime - this.oldTime ) / 1000;
			this.oldTime = newTime;

			this.elapsedTime += diff;

		}

		return diff;

	}

}


function legacy(Base){return class extends Base{constructor(...args){super(...args);const initial=this.intensity;Object.defineProperty(this,'intensity',{configurable:true,get(){return this._legacyIntensity*Math.PI},set(v){this._legacyIntensity=v}});this.intensity=initial}}}
Object.assign(T,{SphereGeometry,AmbientLight,PointLightShadow,PointLight,FogExp2,Clock,LegacyAmbientLight:legacy(AmbientLight),LegacyDirectionalLight:legacy(T.DirectionalLight),LegacyHemisphereLight:legacy(T.HemisphereLight)});
})(window);
