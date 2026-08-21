import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

class MediConnect3D {
  constructor() {
    this.container = document.getElementById('three-canvas');
    if (!this.container) return;

    try {
      this.initScene();
    } catch (e) {
      console.warn('[MediConnect3D] Scene initialization failed:', e);
      if (this.container) this.container.style.display = 'none';
      return;
    }
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1220);
    this.scene.fog = new THREE.FogExp2(0x0b1220, 0.012);

    this.camera = new THREE.PerspectiveCamera(
      55,
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
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

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
  }

  initLights() {
    const ambient = new THREE.AmbientLight(0x1e293b, 0.9);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(12, 18, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 1024;
    dir.shadow.mapSize.height = 1024;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 50;
    this.scene.add(dir);

    const cyan = new THREE.PointLight(0x00d4ff, 4, 55);
    cyan.position.set(-9, 5, 7);
    this.scene.add(cyan);

    const blue = new THREE.PointLight(0x2563eb, 4, 55);
    blue.position.set(9, 4, -5);
    this.scene.add(blue);

    const warm = new THREE.PointLight(0x60a5fa, 2.5, 45);
    warm.position.set(0, 6, 2);
    this.scene.add(warm);
  }

  initEnvironment() {
    const grid = new THREE.GridHelper(90, 90, 0x1e3a5f, 0x0f1d32);
    grid.position.y = -2;
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    this.scene.add(grid);

    const floorGeo = new THREE.PlaneGeometry(90, 90);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c1a2e,
      roughness: 0.65,
      metalness: 0.35,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.01;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const glowGeo = new THREE.PlaneGeometry(50, 50);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.04,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -1.99;
    this.scene.add(glow);

    const platformGeo = new THREE.CylinderGeometry(3.2, 3.8, 0.25, 48);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.65,
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.set(0, -1.88, 8);
    platform.receiveShadow = true;
    this.scene.add(platform);

    const ringGeo = new THREE.TorusGeometry(3.6, 0.04, 16, 80);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x00d4ff,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, -1.75, 8);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);
    this.platformRing = ring;
  }

  createMaterial(color, emissive = 0x000000) {
    return new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.35,
    });
  }

  initDoctor() {
    this.doctor = new THREE.Group();
    const skin = this.createMaterial(0xf1c27d);
    const scrubs = this.createMaterial(0xffffff, 0x1e293b);
    const hairMaterial = this.createMaterial(0x3f2e22);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 32, 32), skin);
    head.position.y = 1.95;
    head.castShadow = true;
    this.doctor.add(head);

    const hairGeo = new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const hair = new THREE.Mesh(hairGeo, hairMaterial);
    hair.position.y = 1.95;
    this.doctor.add(hair);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 1.4, 32), scrubs);
    body.position.y = 1.15;
    body.castShadow = true;
    this.doctor.add(body);

    const crossGeo = new THREE.BoxGeometry(0.18, 0.45, 0.07);
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.9,
      roughness: 0.25,
      metalness: 0.75,
    });
    const cross = new THREE.Mesh(crossGeo, crossMat);
    cross.position.set(0, 1.25, 0.48);
    this.doctor.add(cross);

    const armGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.85, 16);
    const leftArm = new THREE.Mesh(armGeo, scrubs);
    leftArm.position.set(-0.52, 1.25, 0);
    leftArm.rotation.z = 0.2;
    leftArm.castShadow = true;
    this.doctor.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, scrubs);
    rightArm.position.set(0.52, 1.25, 0);
    rightArm.rotation.z = -0.2;
    rightArm.castShadow = true;
    this.doctor.add(rightArm);

    const legGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.0, 16);
    const leftLeg = new THREE.Mesh(legGeo, scrubs);
    leftLeg.position.set(-0.18, 0.2, 0);
    leftLeg.castShadow = true;
    this.doctor.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, scrubs);
    rightLeg.position.set(0.18, 0.2, 0);
    rightLeg.castShadow = true;
    this.doctor.add(rightLeg);

    const haloGeo = new THREE.TorusGeometry(0.9, 0.025, 16, 48);
    const haloMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      emissive: 0x00d4ff,
      emissiveIntensity: 1.1,
      roughness: 0.2,
      metalness: 0.8,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.y = 2.55;
    halo.rotation.x = Math.PI / 2;
    this.doctor.add(halo);
    this.doctorHalo = halo;

    const glowGeo = new THREE.SphereGeometry(0.85, 24, 24);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.06,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 1.6;
    this.doctor.add(glow);
    this.doctorGlow = glow;

    this.doctor.position.set(-4, 0, 10);
    this.doctor.rotation.y = 0.3;
    this.scene.add(this.doctor);
  }

  initPatient() {
    this.patient = new THREE.Group();
    const skin = this.createMaterial(0xdca07a);
    const clothes = this.createMaterial(0x334155, 0x1e293b);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 32), skin);
    head.position.y = 1.85;
    head.castShadow = true;
    this.patient.add(head);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 1.25, 32), clothes);
    body.position.y = 1.05;
    body.castShadow = true;
    this.patient.add(body);

    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.72, 16);
    const leftArm = new THREE.Mesh(armGeo, clothes);
    leftArm.position.set(-0.38, 1.15, 0);
    leftArm.rotation.z = 0.15;
    this.patient.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, clothes);
    rightArm.position.set(0.38, 1.15, 0);
    rightArm.rotation.z = -0.15;
    this.patient.add(rightArm);

    const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.95, 16);
    const leftLeg = new THREE.Mesh(legGeo, clothes);
    leftLeg.position.set(-0.14, 0.2, 0);
    this.patient.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, clothes);
    rightLeg.position.set(0.14, 0.2, 0);
    this.patient.add(rightLeg);

    const heartGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const heartMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 1.4,
      roughness: 0.25,
      metalness: 0.6,
    });
    const heart = new THREE.Mesh(heartGeo, heartMat);
    heart.position.set(0, 1.25, 0.38);
    this.patient.add(heart);
    this.patientHeart = heart;

    const glowGeo = new THREE.SphereGeometry(0.85, 20, 20);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.06,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 1.25;
    this.patient.add(glow);
    this.patientGlow = glow;

    this.patient.position.set(4, 0, 8);
    this.patient.rotation.y = -0.3;
    this.scene.add(this.patient);
  }

  initHeartbeat() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4, 2.15, 10),
      new THREE.Vector3(-2, 2.7, 9),
      new THREE.Vector3(0, 1.75, 9),
      new THREE.Vector3(2, 2.55, 8.5),
      new THREE.Vector3(4, 2.15, 8),
    ]);

    const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.1, 16, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.6,
      roughness: 0.25,
      metalness: 0.7,
    });
    this.heartbeat = new THREE.Mesh(tubeGeo, tubeMat);
    this.heartbeat.visible = false;
    this.scene.add(this.heartbeat);

    this.heartbeatPulse = 0;
  }

  initChatInterface() {
    this.chatGroup = new THREE.Group();
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.25,
      roughness: 0.35,
      transparent: true,
      opacity: 0.45,
    });

    for (let i = 0; i < 5; i++) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 1.25),
        glassMat
      );
      panel.position.set(
        (Math.random() - 0.5) * 4.5,
        2.2 + Math.random() * 2.2,
        4.5 - i * 1.3
      );
      panel.rotation.y = (Math.random() - 0.5) * 0.5;
      this.chatGroup.add(panel);

      const dotGeo = new THREE.SphereGeometry(0.04, 8, 8);
      const dotMat = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.2,
      });
      for (let j = 0; j < 7; j++) {
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(
          (Math.random() - 0.5) * 1.6,
          (Math.random() - 0.5) * 0.9,
          4.51 - i * 1.3
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
      color: 0x0f172a,
      emissive: 0x1e293b,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.5,
    });

    for (let i = 0; i < 7; i++) {
      const card = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.75, 0.09),
        cardMat
      );
      card.position.set(
        (Math.random() - 0.5) * 6,
        1.6 + Math.random() * 2.4,
        -1 + i * 0.75
      );
      card.rotation.y = (Math.random() - 0.5) * 0.4;
      card.rotation.x = (Math.random() - 0.5) * 0.2;
      this.appointmentsGroup.add(card);

      const accentGeo = new THREE.BoxGeometry(1.3, 0.08, 0.1);
      const accentMat = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1,
        roughness: 0.25,
        metalness: 0.75,
      });
      const accent = new THREE.Mesh(accentGeo, accentMat);
      accent.position.copy(card.position);
      accent.position.y += 0.32;
      accent.rotation.copy(card.rotation);
      this.appointmentsGroup.add(accent);
    }

    this.appointmentsGroup.visible = false;
    this.scene.add(this.appointmentsGroup);
  }

  initMedicalRecords() {
    this.recordsGroup = new THREE.Group();
    const paperMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 10; i++) {
      const doc = new THREE.Mesh(
        new THREE.PlaneGeometry(0.85, 1.2),
        paperMat
      );
      doc.position.set(
        (Math.random() - 0.5) * 5.5,
        1.2 + Math.random() * 2.6,
        -6 + i * 0.55
      );
      doc.rotation.y = (Math.random() - 0.5) * 0.6;
      this.recordsGroup.add(doc);

      const lineGeo = new THREE.PlaneGeometry(0.75, 0.035);
      const lineMat = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.45,
      });
      for (let j = 0; j < 4; j++) {
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.position.copy(doc.position);
        line.position.z += 0.01;
        line.position.y -= 0.35 + j * 0.22;
        line.rotation.copy(doc.rotation);
        this.recordsGroup.add(line);
      }
    }

    this.recordsGroup.visible = false;
    this.scene.add(this.recordsGroup);
  }

  initAIAssistant() {
    this.aiGroup = new THREE.Group();

    const brainGeo = new THREE.IcosahedronGeometry(1.9, 3);
    const brainMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.5,
      roughness: 0.35,
      metalness: 0.55,
    });
    this.aiBrain = new THREE.Mesh(brainGeo, brainMat);
    this.aiBrain.position.set(0, 4.2, -12);
    this.aiGroup.add(this.aiBrain);

    const wireGeo = new THREE.IcosahedronGeometry(2.4, 2);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    this.aiWire = new THREE.Mesh(wireGeo, wireMat);
    this.aiWire.position.copy(this.aiBrain.position);
    this.aiGroup.add(this.aiWire);

    const ringGeo = new THREE.TorusGeometry(2.6, 0.035, 16, 80);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.2,
      roughness: 0.25,
      metalness: 0.8,
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
    const count = 700;
    const geo = new THREE.SphereGeometry(0.04, 8, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.9,
    });
    this.particles = new THREE.InstancedMesh(geo, mat, count);
    this.particleData = [];
    this._reusableMatrix = new THREE.Matrix4();

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 45;
      const y = Math.random() * 16 - 3;
      const z = (Math.random() - 0.5) * 55;
      const matrix = new THREE.Matrix4();
      matrix.setPosition(x, y, z);
      this.particles.setMatrixAt(i, matrix);
      this.particleData.push({ x, y, z, speed: Math.random() * 0.4 + 0.1 });
    }
    this.scene.add(this.particles);
  }

  initCameraPath() {
    this.cameraPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 3.2, 18),
      new THREE.Vector3(-3, 3.6, 12),
      new THREE.Vector3(2, 3.2, 7),
      new THREE.Vector3(-4, 4.2, 2),
      new THREE.Vector3(3, 3.8, -2),
      new THREE.Vector3(-2, 5.2, -8),
      new THREE.Vector3(0, 10, -18),
    ]);

    this.lookAtPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 2, 9),
      new THREE.Vector3(0, 2.2, 8),
      new THREE.Vector3(0, 2.5, 4),
      new THREE.Vector3(-3, 2.5, -1),
      new THREE.Vector3(3, 2.5, -5),
      new THREE.Vector3(0, 4, -10),
      new THREE.Vector3(0, 2, -14),
    ]);
  }

  initPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.45,
      0.45,
      0.88
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
      this.camera.position.x += this.mouse.x * 0.4;
      this.camera.position.y += this.mouse.y * 0.25;
      this.camera.lookAt(lookPos);

      this.updateVisibility(t);

      if (this.doctor) {
        this.doctor.rotation.y = 0.3 + Math.sin(time * 0.5) * 0.12;
        this.doctor.position.y = Math.sin(time * 0.8) * 0.08;
        if (this.doctorHalo) {
          this.doctorHalo.rotation.z = time * 0.4;
          this.doctorHalo.material.emissiveIntensity = 1.1 + Math.sin(time * 1.8) * 0.4;
        }
        if (this.doctorGlow) {
          this.doctorGlow.scale.setScalar(1 + Math.sin(time * 1.4) * 0.15);
        }
      }
      if (this.patient) {
        this.patient.rotation.y = -0.3 + Math.sin(time * 0.5 + 1) * 0.12;
        this.patient.position.y = Math.sin(time * 0.8 + 1) * 0.08;
        if (this.patientHeart) {
          this.patientHeart.scale.setScalar(1 + Math.sin(time * 3) * 0.25);
        }
        if (this.patientGlow) {
          this.patientGlow.scale.setScalar(1 + Math.sin(time * 1.4 + 0.5) * 0.15);
        }
      }

      if (this.heartbeat && this.heartbeat.visible) {
        this.heartbeatPulse = (this.heartbeatPulse + dt * 3) % 1;
        this.heartbeat.material.emissiveIntensity = 1.6 + Math.sin(this.heartbeatPulse * Math.PI) * 2.2;
      }

      if (this.chatGroup && this.chatGroup.visible) {
        this.chatGroup.children.forEach((child, i) => {
          child.position.y += Math.sin(time * 2 + i) * 0.002;
          child.rotation.y += Math.sin(time + i) * 0.004;
        });
      }

      if (this.appointmentsGroup && this.appointmentsGroup.visible) {
        this.appointmentsGroup.children.forEach((child, i) => {
          child.rotation.y += Math.sin(time * 0.5 + i * 0.5) * 0.004;
          child.position.y += Math.cos(time + i) * 0.002;
        });
      }

      if (this.aiBrain) {
        this.aiBrain.rotation.y += dt * 0.25;
        this.aiBrain.rotation.x += dt * 0.12;
        this.aiWire.rotation.y -= dt * 0.12;
        this.aiWire.rotation.z += dt * 0.06;
      }

      if (this.particles) {
        for (let i = 0; i < this.particleData.length; i++) {
          const p = this.particleData[i];
          const y = p.y + Math.sin(time * p.speed + p.x) * 0.45;
          this._reusableMatrix.setPosition(p.x, y, p.z);
          this.particles.setMatrixAt(i, this._reusableMatrix);
        }
        this.particles.instanceMatrix.needsUpdate = true;
      }

      if (this.platformRing) {
        this.platformRing.rotation.z = time * 0.25;
        this.platformRing.material.emissiveIntensity = 0.9 + Math.sin(time * 1.4) * 0.35;
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
