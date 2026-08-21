import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

class MediConnect3D {
  constructor() {
    this.container = document.getElementById('three-canvas');
    if (!this.container) return;

    try {
      this.initScene();
      console.log('[MediConnect3D] Scene initialized successfully');
    } catch (e) {
      console.warn('[MediConnect3D] Scene initialization failed:', e);
      if (this.container) this.container.style.display = 'none';
      return;
    }
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050b14);
    this.scene.fog = new THREE.FogExp2(0x050b14, 0.014);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.clock = new THREE.Clock();
    this.scrollProgress = 0;
    this.targetScrollProgress = 0;
    this.mouse = new THREE.Vector2(0, 0);

    this.initLights();
    this.initEnvironment();
    this.initDoctor();
    this.initPatient();
    this.initHeartbeat();
    this.initChatInterface();
    this.initAppointments();
    this.initMedicalRecords();
    this.initAIAssistant();
    this.initParticles();
    this.initCameraPath();
    this.initPostProcessing();
    this.initEvents();

    this.animate();
    console.log('[MediConnect3D] Animation loop started');
  }

  initLights() {
    const ambient = new THREE.AmbientLight(0x415a80, 0.6);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(10, 20, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 1024;
    dir.shadow.mapSize.height = 1024;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 50;
    this.scene.add(dir);

    const cyan = new THREE.PointLight(0x00d4ff, 4, 70);
    cyan.position.set(-10, 5, 8);
    this.scene.add(cyan);

    const blue = new THREE.PointLight(0x3366dd, 4, 70);
    blue.position.set(10, 4, -5);
    this.scene.add(blue);

    const warm = new THREE.PointLight(0x88bbff, 2, 60);
    warm.position.set(0, 7, 2);
    this.scene.add(warm);
  }

  initEnvironment() {
    const grid = new THREE.GridHelper(100, 100, 0x2a4a6a, 0x0a1a3a);
    grid.position.y = -2;
    grid.material.transparent = true;
    grid.material.opacity = 0.6;
    this.scene.add(grid);

    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f1f35,
      roughness: 0.5,
      metalness: 0.5,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.01;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const glowGeo = new THREE.PlaneGeometry(60, 60);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -1.99;
    this.scene.add(glow);

    const platformGeo = new THREE.CylinderGeometry(3, 3.5, 0.2, 32);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a5c,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.7,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.set(0, -1.9, 8);
    platform.receiveShadow = true;
    this.scene.add(platform);
    this.platform = platform;

    const ringGeo = new THREE.TorusGeometry(3.2, 0.05, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x00b4e6,
      emissiveIntensity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, -1.8, 8);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);
    this.platformRing = ring;
  }

  createMaterial(color, emissive = 0x000000) {
    return new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: emissive === 0x000000 ? 0 : 0.35,
      roughness: 0.45,
      metalness: 0.1,
    });
  }

  initDoctor() {
    this.doctor = new THREE.Group();
    const skin = this.createMaterial(0xf1c9a5);
    const scrubs = this.createMaterial(0xeef3f8, 0x0a1622);
    const hairMaterial = this.createMaterial(0x3a2a1a);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 32), skin);
    head.position.y = 2.35;
    head.castShadow = true;
    this.doctor.add(head);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.2, 24), skin);
    neck.position.y = 2.1;
    this.doctor.add(neck);

    const hairGeo = new THREE.SphereGeometry(0.36, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.2);
    const hair = new THREE.Mesh(hairGeo, hairMaterial);
    hair.position.y = 2.36;
    this.doctor.add(hair);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 12, 24), scrubs);
    torso.position.y = 1.45;
    torso.castShadow = true;
    this.doctor.add(torso);

    const crossGeo = new THREE.BoxGeometry(0.14, 0.4, 0.05);
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0x0090c8,
      emissive: 0x0090c8,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.4,
    });
    const cross = new THREE.Mesh(crossGeo, crossMat);
    cross.position.set(0, 1.55, 0.34);
    this.doctor.add(cross);

    const armGeo = new THREE.CapsuleGeometry(0.1, 0.7, 8, 16);
    const leftArm = new THREE.Mesh(armGeo, scrubs);
    leftArm.position.set(-0.45, 1.45, 0);
    leftArm.rotation.z = 0.15;
    leftArm.castShadow = true;
    this.doctor.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, scrubs);
    rightArm.position.set(0.45, 1.45, 0);
    rightArm.rotation.z = -0.15;
    rightArm.castShadow = true;
    this.doctor.add(rightArm);

    const legGeo = new THREE.CapsuleGeometry(0.13, 0.8, 8, 16);
    const leftLeg = new THREE.Mesh(legGeo, scrubs);
    leftLeg.position.set(-0.17, 0.5, 0);
    leftLeg.castShadow = true;
    this.doctor.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, scrubs);
    rightLeg.position.set(0.17, 0.5, 0);
    rightLeg.castShadow = true;
    this.doctor.add(rightLeg);

    const haloGeo = new THREE.RingGeometry(0.42, 0.46, 48);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.y = 2.85;
    halo.rotation.x = Math.PI / 2;
    this.doctor.add(halo);
    this.doctorHalo = halo;

    this.doctor.position.set(-4, 0, 10);
    this.doctor.rotation.y = 0.3;
    this.scene.add(this.doctor);
  }

  initPatient() {
    this.patient = new THREE.Group();
    const skin = this.createMaterial(0xd9a878);
    const clothes = this.createMaterial(0x4a6cc4, 0x0a1622);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 32), skin);
    head.position.y = 2.25;
    head.castShadow = true;
    this.patient.add(head);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.2, 24), skin);
    neck.position.y = 2.02;
    this.patient.add(neck);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.85, 12, 24), clothes);
    torso.position.y = 1.38;
    torso.castShadow = true;
    this.patient.add(torso);

    const armGeo = new THREE.CapsuleGeometry(0.095, 0.65, 8, 16);
    const leftArm = new THREE.Mesh(armGeo, clothes);
    leftArm.position.set(-0.42, 1.38, 0);
    leftArm.rotation.z = 0.12;
    leftArm.castShadow = true;
    this.patient.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, clothes);
    rightArm.position.set(0.42, 1.38, 0);
    rightArm.rotation.z = -0.12;
    rightArm.castShadow = true;
    this.patient.add(rightArm);

    const legGeo = new THREE.CapsuleGeometry(0.12, 0.75, 8, 16);
    const leftLeg = new THREE.Mesh(legGeo, clothes);
    leftLeg.position.set(-0.16, 0.47, 0);
    leftLeg.castShadow = true;
    this.patient.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, clothes);
    rightLeg.position.set(0.16, 0.47, 0);
    rightLeg.castShadow = true;
    this.patient.add(rightLeg);

    const heartGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const heartMat = new THREE.MeshStandardMaterial({
      color: 0xff5a7a,
      emissive: 0xff5a7a,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.1,
    });
    const heart = new THREE.Mesh(heartGeo, heartMat);
    heart.position.set(0, 1.45, 0.32);
    this.patient.add(heart);
    this.patientHeart = heart;

    this.patient.position.set(4, 0, 8);
    this.patient.rotation.y = -0.3;
    this.scene.add(this.patient);
  }

  initHeartbeat() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4, 2.2, 10),
      new THREE.Vector3(-2, 2.8, 9),
      new THREE.Vector3(0, 1.8, 9),
      new THREE.Vector3(2, 2.6, 8.5),
      new THREE.Vector3(4, 2.2, 8),
    ]);

    const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.12, 16, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x33c4f0,
      emissive: 0x33c4f0,
      emissiveIntensity: 0.8,
      roughness: 0.25,
      metalness: 0.6,
    });
    this.heartbeat = new THREE.Mesh(tubeGeo, tubeMat);
    this.heartbeat.visible = false;
    this.scene.add(this.heartbeat);

    this.heartbeatPulse = 0;
  }

  initChatInterface() {
    this.chatGroup = new THREE.Group();
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a5c,
      metalness: 0.2,
      roughness: 0.3,
      transparent: true,
      opacity: 0.4,
    });

    for (let i = 0; i < 6; i++) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 1.5),
        glassMat
      );
      panel.position.set(
        (Math.random() - 0.5) * 5,
        2.5 + Math.random() * 2.5,
        5 - i * 1.5
      );
      panel.rotation.y = (Math.random() - 0.5) * 0.5;
      this.chatGroup.add(panel);

      const dotGeo = new THREE.SphereGeometry(0.05, 8, 8);
      const dotMat = new THREE.MeshStandardMaterial({
        color: 0x33c4f0,
        emissive: 0x33c4f0,
        emissiveIntensity: 0.6,
      });
      for (let j = 0; j < 10; j++) {
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 1,
          5.01 - i * 1.5
        );
        this.chatGroup.add(dot);
      }
    }

    this.chatGroup.visible = false;
    this.scene.add(this.chatGroup);
  }

  initAppointments() {
    this.appointmentsGroup = new THREE.Group();
    const cardMat = new THREE.MeshStandardMaterial({
      color: 0x0a1a3a,
      emissive: 0x001133,
      emissiveIntensity: 1,
      roughness: 0.3,
      metalness: 0.5,
    });

    for (let i = 0; i < 8; i++) {
      const card = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.9, 0.1),
        cardMat
      );
      card.position.set(
        (Math.random() - 0.5) * 7,
        2 + Math.random() * 3,
        -1 + i * 1
      );
      card.rotation.y = (Math.random() - 0.5) * 0.4;
      card.rotation.x = (Math.random() - 0.5) * 0.2;
      this.appointmentsGroup.add(card);

      const accentGeo = new THREE.BoxGeometry(1.5, 0.1, 0.12);
      const accentMat = new THREE.MeshStandardMaterial({
        color: 0x33c4f0,
        emissive: 0x33c4f0,
        emissiveIntensity: 0.5,
      });
      const accent = new THREE.Mesh(accentGeo, accentMat);
      accent.position.copy(card.position);
      accent.position.y += 0.4;
      accent.rotation.copy(card.rotation);
      this.appointmentsGroup.add(accent);
    }

    this.appointmentsGroup.visible = false;
    this.scene.add(this.appointmentsGroup);
  }

  initMedicalRecords() {
    this.recordsGroup = new THREE.Group();
    const paperMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a4a,
      roughness: 0.5,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 12; i++) {
      const doc = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1.4),
        paperMat
      );
      doc.position.set(
        (Math.random() - 0.5) * 6,
        1.5 + Math.random() * 3,
        -7 + i * 0.6
      );
      doc.rotation.y = (Math.random() - 0.5) * 0.6;
      this.recordsGroup.add(doc);

      const lineGeo = new THREE.PlaneGeometry(0.9, 0.04);
      const lineMat = new THREE.MeshStandardMaterial({
        color: 0x00d4ff,
        emissive: 0x00d4ff,
        emissiveIntensity: 0.6,
      });
      for (let j = 0; j < 5; j++) {
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.position.copy(doc.position);
        line.position.z += 0.01;
        line.position.y -= 0.4 + j * 0.25;
        line.rotation.copy(doc.rotation);
        this.recordsGroup.add(line);
      }
    }

    this.recordsGroup.visible = false;
    this.scene.add(this.recordsGroup);
  }

  initAIAssistant() {
    this.aiGroup = new THREE.Group();

    const brainGeo = new THREE.IcosahedronGeometry(2.2, 3);
    const brainMat = new THREE.MeshStandardMaterial({
      color: 0x0a1a3a,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.6,
      wireframe: false,
    });
    this.aiBrain = new THREE.Mesh(brainGeo, brainMat);
    this.aiBrain.position.set(0, 5, -14);
    this.aiGroup.add(this.aiBrain);

    const wireGeo = new THREE.IcosahedronGeometry(2.8, 2);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    this.aiWire = new THREE.Mesh(wireGeo, wireMat);
    this.aiWire.position.copy(this.aiBrain.position);
    this.aiGroup.add(this.aiWire);

    const ringGeo = new THREE.TorusGeometry(3, 0.04, 16, 80);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x33c4f0,
      emissive: 0x33c4f0,
      emissiveIntensity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(this.aiBrain.position);
    ring.rotation.x = Math.PI / 2;
    this.aiGroup.add(ring);

    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.position.copy(this.aiBrain.position);
    ring2.rotation.x = Math.PI / 3;
    ring2.rotation.z = Math.PI / 4;
    this.aiGroup.add(ring2);

    const ring3 = new THREE.Mesh(ringGeo, ringMat);
    ring3.position.copy(this.aiBrain.position);
    ring3.rotation.x = Math.PI / 4;
    ring3.rotation.z = -Math.PI / 3;
    this.aiGroup.add(ring3);

    this.aiGroup.visible = false;
    this.scene.add(this.aiGroup);
  }

  initParticles() {
    const count = 1000;
    const geo = new THREE.SphereGeometry(0.05, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x66d4f0,
      emissive: 0x66d4f0,
      emissiveIntensity: 0.4,
    });
    this.particles = new THREE.InstancedMesh(geo, mat, count);
    this.particleData = [];
    this._reusableMatrix = new THREE.Matrix4();

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 50;
      const y = Math.random() * 18 - 4;
      const z = (Math.random() - 0.5) * 60;
      const matrix = new THREE.Matrix4();
      matrix.setPosition(x, y, z);
      this.particles.setMatrixAt(i, matrix);
      this.particleData.push({ x, y, z, speed: Math.random() * 0.5 + 0.1 });
    }
    this.scene.add(this.particles);
  }

  initCameraPath() {
    this.cameraPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 3.5, 20),
      new THREE.Vector3(-4, 4, 13),
      new THREE.Vector3(3, 3.5, 8),
      new THREE.Vector3(-5, 4.5, 3),
      new THREE.Vector3(4, 4, -2),
      new THREE.Vector3(-3, 5.5, -9),
      new THREE.Vector3(0, 11, -20),
    ]);

    this.lookAtPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 2.2, 10),
      new THREE.Vector3(0, 2.5, 9),
      new THREE.Vector3(0, 2.8, 5),
      new THREE.Vector3(-3, 3, -1),
      new THREE.Vector3(3, 3, -6),
      new THREE.Vector3(0, 4.5, -12),
      new THREE.Vector3(0, 2, -16),
    ]);
  }

  initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.28,
      0.5,
      0.92
    );
    this.composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  initEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }

  dispose() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this.renderer) this.renderer.dispose();
    if (this.composer) this.composer.dispose();
  }

  setScrollProgress(t) {
    this.targetScrollProgress = Math.max(0, Math.min(1, t));
  }

  updateVisibility(t) {
    const show = (obj, start, end) => {
      if (obj) obj.visible = t >= start && t <= end + 0.05;
    };

    show(this.doctor, 0, 1);
    show(this.patient, 0, 1);
    show(this.heartbeat, 0.15, 0.35);
    show(this.chatGroup, 0.3, 0.55);
    show(this.appointmentsGroup, 0.45, 0.7);
    show(this.recordsGroup, 0.6, 0.8);
    show(this.aiGroup, 0.75, 1);
  }

  animate() {
    const loop = () => {
      this._rafId = requestAnimationFrame(loop);

      const dt = this.clock.getDelta();
      const time = this.clock.getElapsedTime();

      this.scrollProgress += (this.targetScrollProgress - this.scrollProgress) * 0.05;

      const t = this.scrollProgress;
      const camPos = this.cameraPath.getPoint(t);
      const lookPos = this.lookAtPath.getPoint(t);

      this.camera.position.copy(camPos);
      this.camera.position.x += this.mouse.x * 0.5;
      this.camera.position.y += this.mouse.y * 0.3;
      this.camera.lookAt(lookPos);

      this.updateVisibility(t);

      if (this.doctor) {
        this.doctor.rotation.y = 0.3 + Math.sin(time * 0.5) * 0.15;
        this.doctor.position.y = Math.sin(time * 0.8) * 0.1;
        if (this.doctorHalo) {
          this.doctorHalo.rotation.z = time * 0.5;
        }
      }
      if (this.patient) {
        this.patient.rotation.y = -0.3 + Math.sin(time * 0.5 + 1) * 0.15;
        this.patient.position.y = Math.sin(time * 0.8 + 1) * 0.1;
        if (this.patientHeart) {
          this.patientHeart.scale.setScalar(1 + Math.sin(time * 3) * 0.25);
        }
      }

      if (this.heartbeat && this.heartbeat.visible) {
        this.heartbeatPulse = (this.heartbeatPulse + dt * 3) % 1;
        this.heartbeat.material.emissiveIntensity = 1.2 + Math.sin(this.heartbeatPulse * Math.PI) * 1.2;
      }

      if (this.chatGroup && this.chatGroup.visible) {
        this.chatGroup.children.forEach((child, i) => {
          child.position.y += Math.sin(time * 2 + i) * 0.004;
          child.rotation.y += Math.sin(time + i) * 0.006;
        });
      }

      if (this.appointmentsGroup && this.appointmentsGroup.visible) {
        this.appointmentsGroup.children.forEach((child, i) => {
          child.rotation.y += Math.sin(time * 0.5 + i * 0.5) * 0.006;
          child.position.y += Math.cos(time + i) * 0.004;
        });
      }

      if (this.aiBrain) {
        this.aiBrain.rotation.y += dt * 0.3;
        this.aiBrain.rotation.x += dt * 0.15;
        this.aiWire.rotation.y -= dt * 0.15;
        this.aiWire.rotation.z += dt * 0.08;
      }

      if (this.particles) {
        for (let i = 0; i < this.particleData.length; i++) {
          const p = this.particleData[i];
          const y = p.y + Math.sin(time * p.speed + p.x) * 0.6;
          this._reusableMatrix.setPosition(p.x, y, p.z);
          this.particles.setMatrixAt(i, this._reusableMatrix);
        }
        this.particles.instanceMatrix.needsUpdate = true;
      }

      if (this.platformRing) {
        this.platformRing.rotation.z = time * 0.3;
        this.platformRing.material.emissiveIntensity = 1.5 + Math.sin(time * 1.5) * 0.5;
      }

      this.composer.render();
    };
    loop();
  }
}

let app3d = null;
function initMediConnect3D() {
  if (app3d) return;
  app3d = new MediConnect3D();
  window.app3d = app3d;
}
export { initMediConnect3D, MediConnect3D };
