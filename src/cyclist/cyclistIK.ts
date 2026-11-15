export interface Point2D {
  x: number;
  y: number;
}

export interface CyclistGeometryParams {
  hip: Point2D;
  ankle: Point2D;
  thighLength: number;
  shinLength: number;
}

/**
 * Exact 2-bone analytical Inverse Kinematics (Law of Cosines).
 * For a cyclist riding left-to-right (+X), the knee always bends forward (+X / upward-right normal).
 */
export function solveKneeIK({
  hip,
  ankle,
  thighLength: L1,
  shinLength: L2,
}: CyclistGeometryParams): Point2D {
  const dx = ankle.x - hip.x;
  const dy = ankle.y - hip.y;
  const rawDist = Math.hypot(dx, dy);

  // Clamp distance strictly inside reachable triangle bounds to prevent NaN or snap
  const minD = Math.abs(L1 - L2) + 0.5;
  const maxD = L1 + L2 - 0.5;
  const d = Math.max(minD, Math.min(maxD, rawDist));

  const ux = dx / (rawDist || 1);
  const uy = dy / (rawDist || 1);

  // Projection along hip -> ankle vector and perpendicular height
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));

  // Forward-bending normal in screen space (+X right, +Y down): (uy, -ux) points up-right when dx>0, dy>0?
  // Check: if dx = +30, dy = +80, (ux, uy) = (0.35, 0.94).
  // Normal (+uy, -ux) = (+0.94, -0.35) -> points RIGHT (+X) and slightly UP (-Y)!
  return {
    x: hip.x + a * ux + h * uy,
    y: hip.y + a * uy - h * ux,
  };
}

function drawSpokedWheel(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  wheelAngle: number
) {
  const tireOuterR = radius;
  const rimOuterR = radius - 4.2;
  const rimInnerR = radius - 8.2;
  const hubR = 5.4;

  // 1. Dark rubber tire with subtle golden-hour tread rim highlight
  ctx.beginPath();
  ctx.arc(cx, cy, tireOuterR, 0, Math.PI * 2);
  ctx.lineWidth = 4.6;
  ctx.strokeStyle = '#1b1d24';
  ctx.stroke();

  // Warm afternoon sheen on upper tire edge
  ctx.beginPath();
  ctx.arc(cx, cy, tireOuterR - 0.6, Math.PI * 1.05, Math.PI * 1.9);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(247, 200, 126, 0.35)';
  ctx.stroke();

  // Rotating tan-wall tire logo patch so wheel spin is unmistakably visible
  for (let p = 0; p < 2; p++) {
    const a = wheelAngle + p * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, tireOuterR - 1.5, a - 0.14, a + 0.14);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#d99a5b';
    ctx.stroke();
  }

  // 2. Deep-section alloy/carbon rim
  ctx.beginPath();
  ctx.arc(cx, cy, (rimOuterR + rimInnerR) * 0.5, 0, Math.PI * 2);
  ctx.lineWidth = 4.0;
  ctx.strokeStyle = '#2c313d';
  ctx.stroke();

  // Crisp machined brake/rim accent ring
  ctx.beginPath();
  ctx.arc(cx, cy, rimOuterR - 0.6, 0, Math.PI * 2);
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = '#9aa3b5';
  ctx.stroke();

  // 3. Twelve bladed spokes rotating strictly with wheelAngle
  const spokeCount = 12;
  ctx.lineWidth = 1.15;
  for (let i = 0; i < spokeCount; i++) {
    const a = wheelAngle + (i * Math.PI * 2) / spokeCount;
    // Alternate slight tangent angle for realistic 2-cross wheel lacing look
    const hubA = a + (i % 2 === 0 ? 0.24 : -0.24);
    const sx = cx + Math.cos(hubA) * hubR;
    const sy = cy + Math.sin(hubA) * hubR;
    const ex = cx + Math.cos(a) * rimInnerR;
    const ey = cy + Math.sin(a) * rimInnerR;

    ctx.strokeStyle = i % 3 === 0 ? 'rgba(218, 224, 238, 0.72)' : 'rgba(155, 165, 185, 0.52)';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  // 4. Brass valve stem rotating with rim (great visual anchor for spin!)
  const vx = cx + Math.cos(wheelAngle + 0.5) * rimInnerR;
  const vy = cy + Math.sin(wheelAngle + 0.5) * rimInnerR;
  const vx2 = cx + Math.cos(wheelAngle + 0.5) * (rimInnerR - 5.5);
  const vy2 = cy + Math.sin(wheelAngle + 0.5) * (rimInnerR - 5.5);
  ctx.strokeStyle = '#f2c96b';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(vx, vy);
  ctx.lineTo(vx2, vy2);
  ctx.stroke();

  // 5. Rotating vented disc brake rotor
  const rotorR = 13.5;
  ctx.beginPath();
  ctx.arc(cx, cy, rotorR, 0, Math.PI * 2);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#a7b1c4';
  ctx.stroke();

  ctx.strokeStyle = '#737d91';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) {
    const a = wheelAngle + (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * hubR, cy + Math.sin(a) * hubR);
    ctx.lineTo(cx + Math.cos(a + 0.25) * rotorR, cy + Math.sin(a + 0.25) * rotorR);
    ctx.stroke();
  }

  // 6. Center hub + quick-release cap
  ctx.fillStyle = '#1f232d';
  ctx.beginPath();
  ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#d6deec';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  hip: Point2D,
  knee: Point2D,
  ankle: Point2D,
  pedal: Point2D,
  footAngle: number,
  isNear: boolean
) {
  const bibColor = isNear ? '#1e2433' : '#141822';
  const skinBase = isNear ? '#d99b72' : '#a8714e';
  const skinHighlight = isNear ? '#f2ba8c' : '#be835e';
  const sockColor = isNear ? '#f4f6fb' : '#b7c0d1';
  const shoeColor = isNear ? '#eef1f7' : '#9ca5b8';
  const shoeSole = '#161922';

  // 1. Bib shorts thigh upper sleeve
  const thighMidX = hip.x + (knee.x - hip.x) * 0.56;
  const thighMidY = hip.y + (knee.y - hip.y) * 0.56;

  // Bare lower thigh + calf
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Thigh muscle volume (tapered polygon from hip to knee)
  const tDx = knee.x - hip.x;
  const tDy = knee.y - hip.y;
  const tLen = Math.hypot(tDx, tDy) || 1;
  const tNx = -tDy / tLen;
  const tNy = tDx / tLen;

  // Bare knee -> lower thigh
  ctx.strokeStyle = skinBase;
  ctx.lineWidth = 14.5;
  ctx.beginPath();
  ctx.moveTo(thighMidX, thighMidY);
  ctx.lineTo(knee.x, knee.y);
  ctx.stroke();

  // Warm rim highlight on front of thigh
  if (isNear) {
    ctx.strokeStyle = skinHighlight;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(thighMidX + tNx * 4.5, thighMidY + tNy * 4.5);
    ctx.lineTo(knee.x + tNx * 3.5, knee.y + tNy * 3.5);
    ctx.stroke();
  }

  // Cycling bib short upper leg
  ctx.fillStyle = bibColor;
  ctx.beginPath();
  ctx.moveTo(hip.x + tNx * 10.5, hip.y + tNy * 10.5);
  ctx.lineTo(thighMidX + tNx * 7.8, thighMidY + tNy * 7.8);
  ctx.lineTo(thighMidX - tNx * 7.6, thighMidY - tNy * 7.6);
  ctx.lineTo(hip.x - tNx * 10.2, hip.y - tNy * 10.2);
  ctx.closePath();
  ctx.fill();

  // Subtle crimson/amber gripper band at hem of bib shorts
  ctx.strokeStyle = isNear ? '#e05b47' : '#8f392e';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(thighMidX + tNx * 7.8, thighMidY + tNy * 7.8);
  ctx.lineTo(thighMidX - tNx * 7.6, thighMidY - tNy * 7.6);
  ctx.stroke();

  // 2. Lower leg (calf + sock)
  const sDx = ankle.x - knee.x;
  const sDy = ankle.y - knee.y;
  const sLen = Math.hypot(sDx, sDy) || 1;
  const sNx = -sDy / sLen;
  const sNy = sDx / sLen;
  const calfPeakX = knee.x + sDx * 0.34 - sNx * 2.2;
  const calfPeakY = knee.y + sDy * 0.34 - sNy * 2.2;
  const sockTopX = knee.x + sDx * 0.66;
  const sockTopY = knee.y + sDy * 0.66;

  // Sculpted bare calf
  ctx.fillStyle = skinBase;
  ctx.beginPath();
  ctx.moveTo(knee.x + sNx * 6.4, knee.y + sNy * 6.4);
  ctx.quadraticCurveTo(calfPeakX + sNx * 7.2, calfPeakY + sNy * 7.2, sockTopX + sNx * 4.4, sockTopY + sNy * 4.4);
  ctx.lineTo(sockTopX - sNx * 4.6, sockTopY - sNy * 4.6);
  ctx.quadraticCurveTo(calfPeakX - sNx * 7.8, calfPeakY - sNy * 7.8, knee.x - sNx * 6.2, knee.y - sNy * 6.2);
  ctx.closePath();
  ctx.fill();

  // Patella knee highlight
  if (isNear) {
    ctx.fillStyle = skinHighlight;
    ctx.beginPath();
    ctx.arc(knee.x + 1.5, knee.y - 1.0, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Aero cycling sock
  ctx.strokeStyle = sockColor;
  ctx.lineWidth = 8.4;
  ctx.beginPath();
  ctx.moveTo(sockTopX, sockTopY);
  ctx.lineTo(ankle.x, ankle.y);
  ctx.stroke();

  // 3. Clipped-in road cycling shoe aligned to footAngle & anchored to pedal spindle
  ctx.save();
  ctx.translate(pedal.x, pedal.y);
  ctx.rotate(footAngle);

  // Carbon sole
  ctx.fillStyle = shoeSole;
  ctx.beginPath();
  ctx.roundRect(-15, 0.5, 23, 3.2, 1.5);
  ctx.fill();

  // Aerodynamic shoe upper
  ctx.fillStyle = shoeColor;
  ctx.beginPath();
  ctx.moveTo(-14.5, 1);
  ctx.lineTo(-13.5, -7.5);
  ctx.quadraticCurveTo(-5, -8.5, 2, -4.5);
  ctx.quadraticCurveTo(8, -2.5, 8.5, 1);
  ctx.closePath();
  ctx.fill();

  // BOA dial accent
  ctx.fillStyle = isNear ? '#e05b47' : '#7b3932';
  ctx.beginPath();
  ctx.arc(-6.5, -4.5, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Renders the cyclist and road bike centered with bottom bracket at (originX, originY)
 * at scale 1.0 (~210px bike length, wheels radius 45px).
 */
export function drawCyclistAndBike(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  scale: number,
  crankAngle: number,
  wheelAngle: number
) {
  ctx.save();
  ctx.translate(originX, originY);
  ctx.scale(scale, scale);

  // Bike geometry constants (local space, origin = bottom bracket (0, 0))
  const wheelR = 45;
  const rearAxle: Point2D = { x: -58, y: -4 };
  const frontAxle: Point2D = { x: 82, y: -4 };
  const bb: Point2D = { x: 0, y: 0 };
  const seatCluster: Point2D = { x: -24, y: -62 };
  const saddle: Point2D = { x: -30, y: -76 };
  const headTop: Point2D = { x: 60, y: -66 };
  const headBottom: Point2D = { x: 65, y: -48 };
  const stemEnd: Point2D = { x: 75, y: -71 };
  const hoodPos: Point2D = { x: 84, y: -69 };

  // Subtle realistic hip cadence bob (2x per crank rev) + micro road float
  const hipBob = Math.abs(Math.sin(crankAngle)) * 1.8;
  const hip: Point2D = { x: saddle.x + 2, y: saddle.y - 3 + hipBob };

  const crankR = 21.5;
  const thighLen = 55;
  const shinLen = 54;

  // Compute pedal, foot angle (ankling), ankle, and 2-bone IK knee for BOTH legs
  const computeLegKinematics = (angle: number) => {
    const pedal: Point2D = {
      x: bb.x + Math.cos(angle) * crankR,
      y: bb.y + Math.sin(angle) * crankR,
    };
    // Subtle realistic road-cycling ankling: heel drops slightly over top, toes slightly down at bottom
    const footAngle = 0.16 + 0.17 * Math.sin(angle - 0.55);
    const ankle: Point2D = {
      x: pedal.x - Math.cos(footAngle) * 10.5 + Math.sin(footAngle) * 4.5,
      y: pedal.y - Math.sin(footAngle) * 10.5 - Math.cos(footAngle) * 4.5,
    };
    const knee = solveKneeIK({
      hip,
      ankle,
      thighLength: thighLen,
      shinLength: shinLen,
    });
    return { pedal, footAngle, ankle, knee };
  };

  const rightLeg = computeLegKinematics(crankAngle);
  const leftLeg = computeLegKinematics(crankAngle + Math.PI);

  // -------------------------------------------------------------------------
  // 0. Dynamic Ground Cast Shadow (sun is low ahead/left, casting warm long shadow behind/below)
  // -------------------------------------------------------------------------
  const groundY = wheelR - 4;
  ctx.save();
  ctx.fillStyle = 'rgba(18, 22, 34, 0.34)';
  ctx.beginPath();
  ctx.ellipse(6, groundY + 2, 102, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Contact shadows directly under tires
  ctx.fillStyle = 'rgba(10, 12, 20, 0.58)';
  ctx.beginPath();
  ctx.ellipse(rearAxle.x, groundY + 1, 20, 3.2, 0, 0, Math.PI * 2);
  ctx.ellipse(frontAxle.x, groundY + 1, 20, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // -------------------------------------------------------------------------
  // 1. Far (Left) Crank Arm, Pedal & Articulated Leg (behind bike frame)
  // -------------------------------------------------------------------------
  ctx.strokeStyle = '#252936';
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bb.x, bb.y);
  ctx.lineTo(leftLeg.pedal.x, leftLeg.pedal.y);
  ctx.stroke();

  drawLeg(ctx, hip, leftLeg.knee, leftLeg.ankle, leftLeg.pedal, leftLeg.footAngle, false);

  // -------------------------------------------------------------------------
  // 2. Spinning Front & Rear Wheels
  // -------------------------------------------------------------------------
  drawSpokedWheel(ctx, rearAxle.x, rearAxle.y, wheelR, wheelAngle);
  drawSpokedWheel(ctx, frontAxle.x, frontAxle.y, wheelR, wheelAngle);

  // -------------------------------------------------------------------------
  // 3. Drivetrain: Moving Chain, Cassette & Rear Derailleur
  // -------------------------------------------------------------------------
  const chainringR = 14.5;
  const cassetteR = 6.2;

  // Rear cassette cog
  ctx.fillStyle = '#8b95aa';
  ctx.beginPath();
  ctx.arc(rearAxle.x, rearAxle.y, cassetteR, 0, Math.PI * 2);
  ctx.fill();

  // Rear derailleur hanger + pulley cage
  ctx.strokeStyle = '#222632';
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(rearAxle.x, rearAxle.y);
  ctx.lineTo(rearAxle.x - 3, rearAxle.y + 13);
  ctx.stroke();
  ctx.fillStyle = '#3c4252';
  ctx.beginPath();
  ctx.arc(rearAxle.x - 3, rearAxle.y + 13, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Animated chain links moving along top and bottom tangents
  const drawChainSpan = (x1: number, y1: number, x2: number, y2: number, speedDir: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const links = Math.floor(len / 5.5);
    const shift = (((crankAngle * speedDir) / (Math.PI * 2)) * 8) % 1;
    const normShift = shift < 0 ? shift + 1 : shift;

    ctx.strokeStyle = '#3d4352';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.fillStyle = '#bfc8da';
    for (let i = 0; i < links; i++) {
      const t = (i + normShift) / links;
      if (t < 0 || t > 1) continue;
      ctx.beginPath();
      ctx.arc(x1 + dx * t, y1 + dy * t, 1.0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  drawChainSpan(rearAxle.x, rearAxle.y - cassetteR, bb.x, bb.y - chainringR, 1);
  drawChainSpan(bb.x, bb.y + chainringR, rearAxle.x - 2, rearAxle.y + 13, 1);

  // -------------------------------------------------------------------------
  // 4. Sculpted Road Bike Frame, Fork, Bidon, Saddle & Drop Handlebars
  // -------------------------------------------------------------------------
  // Water bottle cage + bidon on down tube
  ctx.save();
  ctx.translate(23, -24);
  ctx.rotate(0.74);
  ctx.fillStyle = '#e8ecf5';
  ctx.beginPath();
  ctx.roundRect(-5, -14, 10, 19, 3);
  ctx.fill();
  ctx.fillStyle = '#e05b47';
  ctx.fillRect(-5, -10, 10, 4);
  ctx.restore();

  // Frame main tubes (sleek slate-crimson carbon road frame with golden-hour rim)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Rear triangle (chainstay & seatstay)
  ctx.strokeStyle = '#2c3446';
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.moveTo(rearAxle.x, rearAxle.y);
  ctx.lineTo(bb.x, bb.y);
  ctx.moveTo(rearAxle.x, rearAxle.y);
  ctx.lineTo(seatCluster.x, seatCluster.y);
  ctx.stroke();

  // Seatpost
  ctx.strokeStyle = '#1b1f29';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(seatCluster.x, seatCluster.y);
  ctx.lineTo(saddle.x + 2, saddle.y + 2);
  ctx.stroke();

  // Saddle
  ctx.fillStyle = '#14171f';
  ctx.beginPath();
  ctx.moveTo(saddle.x - 13, saddle.y);
  ctx.quadraticCurveTo(saddle.x, saddle.y - 3.5, saddle.x + 13, saddle.y + 0.5);
  ctx.lineTo(saddle.x + 11, saddle.y + 3.5);
  ctx.lineTo(saddle.x - 11, saddle.y + 2.8);
  ctx.closePath();
  ctx.fill();

  // Main diamond (seat tube, top tube, down tube, head tube)
  ctx.strokeStyle = '#d6473a';
  ctx.lineWidth = 5.4;
  ctx.beginPath();
  ctx.moveTo(bb.x, bb.y);
  ctx.lineTo(seatCluster.x, seatCluster.y);
  ctx.lineTo(headTop.x, headTop.y);
  ctx.lineTo(headBottom.x, headBottom.y);
  ctx.lineTo(bb.x, bb.y);
  ctx.stroke();

  // Golden-hour top-edge frame sheen
  ctx.strokeStyle = 'rgba(255, 222, 166, 0.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(seatCluster.x + 2, seatCluster.y - 1.5);
  ctx.lineTo(headTop.x - 2, headTop.y - 1.5);
  ctx.stroke();

  // Front fork
  ctx.strokeStyle = '#252b3b';
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(headBottom.x, headBottom.y);
  ctx.quadraticCurveTo(headBottom.x + 11, headBottom.y + 20, frontAxle.x, frontAxle.y);
  ctx.stroke();

  // Stem + Drop Handlebars + Brake Hoods
  ctx.strokeStyle = '#1d212b';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(headTop.x, headTop.y);
  ctx.lineTo(stemEnd.x, stemEnd.y);
  // Drop bar curve
  ctx.moveTo(stemEnd.x, stemEnd.y);
  ctx.quadraticCurveTo(stemEnd.x + 14, stemEnd.y + 1, stemEnd.x + 13, stemEnd.y + 12);
  ctx.quadraticCurveTo(stemEnd.x + 11, stemEnd.y + 22, stemEnd.x - 3, stemEnd.y + 21);
  ctx.stroke();

  // Brake hood & lever
  ctx.fillStyle = '#151820';
  ctx.beginPath();
  ctx.ellipse(hoodPos.x, hoodPos.y, 4.8, 3.2, -0.35, 0, Math.PI * 2);
  ctx.fill();

  // -------------------------------------------------------------------------
  // 5. Far Arm, Cyclist Torso, Aero Helmet & Near Arm
  // -------------------------------------------------------------------------
  const shoulder: Point2D = {
    x: hip.x + 41,
    y: hip.y - 31 + hipBob * 0.4,
  };
  const farElbow: Point2D = {
    x: shoulder.x + 17,
    y: shoulder.y + 14,
  };
  const nearElbow: Point2D = {
    x: shoulder.x + 15,
    y: shoulder.y + 16,
  };

  // Far arm (slightly shaded behind torso)
  ctx.strokeStyle = '#a36e4c';
  ctx.lineWidth = 8.0;
  ctx.beginPath();
  ctx.moveTo(shoulder.x + 3, shoulder.y + 1);
  ctx.lineTo(farElbow.x, farElbow.y);
  ctx.lineTo(hoodPos.x, hoodPos.y);
  ctx.stroke();

  // Cyclist Torso (leaned forward in sleek pro aero jersey)
  ctx.fillStyle = '#243554';
  ctx.beginPath();
  ctx.moveTo(hip.x - 8, hip.y + 4);
  ctx.quadraticCurveTo(hip.x + 10, hip.y - 34, shoulder.x - 4, shoulder.y - 11);
  ctx.quadraticCurveTo(shoulder.x + 11, shoulder.y - 7, shoulder.x + 7, shoulder.y + 9);
  ctx.quadraticCurveTo(hip.x + 18, hip.y - 3, hip.x + 6, hip.y + 8);
  ctx.closePath();
  ctx.fill();

  // Jersey accent stripe & warm afternoon rim highlight along spine/back
  ctx.strokeStyle = '#e86a4a';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(hip.x + 3, hip.y - 9);
  ctx.lineTo(shoulder.x - 1, shoulder.y - 5);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 218, 152, 0.58)';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(hip.x - 5, hip.y - 5);
  ctx.quadraticCurveTo(hip.x + 12, hip.y - 33, shoulder.x - 2, shoulder.y - 11);
  ctx.stroke();

  // Neck + Head + Sunglasses + Aero Helmet
  const headCenter: Point2D = { x: shoulder.x + 12, y: shoulder.y - 16 };

  // Neck
  ctx.strokeStyle = '#d4966e';
  ctx.lineWidth = 7.5;
  ctx.beginPath();
  ctx.moveTo(shoulder.x + 3, shoulder.y - 6);
  ctx.lineTo(headCenter.x - 2, headCenter.y + 4);
  ctx.stroke();

  // Face profile
  ctx.fillStyle = '#d99b72';
  ctx.beginPath();
  ctx.arc(headCenter.x, headCenter.y, 9.2, 0, Math.PI * 2);
  ctx.fill();

  // Wraparound cycling sunglasses
  ctx.fillStyle = '#182236';
  ctx.beginPath();
  ctx.roundRect(headCenter.x + 2.5, headCenter.y - 4.2, 8.2, 4.2, 1.5);
  ctx.fill();
  ctx.strokeStyle = '#f6c87e';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(headCenter.x + 4, headCenter.y - 3.2);
  ctx.lineTo(headCenter.x + 9.5, headCenter.y - 3.2);
  ctx.stroke();

  // Aerodynamic vented helmet
  ctx.fillStyle = '#f3f5fa';
  ctx.beginPath();
  ctx.moveTo(headCenter.x - 13, headCenter.y - 2);
  ctx.quadraticCurveTo(headCenter.x - 6, headCenter.y - 15, headCenter.x + 10, headCenter.y - 9);
  ctx.quadraticCurveTo(headCenter.x + 12.5, headCenter.y - 5.5, headCenter.x + 9, headCenter.y - 3.5);
  ctx.quadraticCurveTo(headCenter.x - 2, headCenter.y - 4.5, headCenter.x - 13, headCenter.y - 2);
  ctx.closePath();
  ctx.fill();

  // Helmet vent stripe & strap
  ctx.fillStyle = '#e05b47';
  ctx.beginPath();
  ctx.ellipse(headCenter.x - 1, headCenter.y - 8.5, 5.2, 1.8, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#252a38';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(headCenter.x - 1, headCenter.y - 3.5);
  ctx.lineTo(headCenter.x - 2, headCenter.y + 6.5);
  ctx.stroke();

  // Near arm + jersey sleeve + fingerless glove gripping hood
  // Short sleeve
  ctx.strokeStyle = '#2f456e';
  ctx.lineWidth = 11.0;
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(shoulder.x + 9, shoulder.y + 7);
  ctx.stroke();

  // Forearm
  ctx.strokeStyle = '#d99b72';
  ctx.lineWidth = 7.8;
  ctx.beginPath();
  ctx.moveTo(shoulder.x + 8, shoulder.y + 6);
  ctx.lineTo(nearElbow.x, nearElbow.y);
  ctx.lineTo(hoodPos.x - 1, hoodPos.y);
  ctx.stroke();

  // Glove
  ctx.fillStyle = '#1b1f29';
  ctx.beginPath();
  ctx.arc(hoodPos.x, hoodPos.y, 4.2, 0, Math.PI * 2);
  ctx.fill();

  // -------------------------------------------------------------------------
  // 6. Near (Right) Chainring, Crank Arm, Pedal & Articulated Leg (in front)
  // -------------------------------------------------------------------------
  // 52T Outer Chainring with rotating 5-arm spider
  ctx.strokeStyle = '#252936';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(bb.x, bb.y, chainringR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#8b95aa';
  ctx.lineWidth = 2.0;
  for (let arm = 0; arm < 5; arm++) {
    const a = crankAngle + (arm * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.moveTo(bb.x, bb.y);
    ctx.lineTo(bb.x + Math.cos(a) * (chainringR - 1), bb.y + Math.sin(a) * (chainringR - 1));
    ctx.stroke();
  }

  // Near leg (in front of frame & chainring)
  drawLeg(ctx, hip, rightLeg.knee, rightLeg.ankle, rightLeg.pedal, rightLeg.footAngle, true);

  // Near crank arm anchored at BB -> right pedal spindle
  ctx.strokeStyle = '#cfd6e6';
  ctx.lineWidth = 4.6;
  ctx.beginPath();
  ctx.moveTo(bb.x, bb.y);
  ctx.lineTo(rightLeg.pedal.x, rightLeg.pedal.y);
  ctx.stroke();

  ctx.fillStyle = '#1e222d';
  ctx.beginPath();
  ctx.arc(bb.x, bb.y, 4.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e05b47';
  ctx.beginPath();
  ctx.arc(rightLeg.pedal.x, rightLeg.pedal.y, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
