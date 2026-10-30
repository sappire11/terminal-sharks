/**
 * The space scene: one 藍咩 and a handful of 航星者 drifting through a pixel-art night sky.
 * The sky itself, from stars and planets to comets and asteroids, lives in sky.ts.
 *
 * Each character has a mode. Most of the time it drifts; on its own 藍咩 stops to look around,
 * watches shooting stars and comets and nods off, and 航星者 stop to stare at one growing a
 * horn or at an asteroid tumbling past. Every
 * 15–30 seconds a small director starts an event: a 航星者 visits 藍咩, a few 航星者 fly past
 * in a line, or 藍咩 takes a nap. Sprites never rotate, so all of this is moving, stopping,
 * turning around, swapping frames and popping little signs above heads.
 *
 * Plain 2D canvas in device pixels. Every sprite is drawn at a whole-number scale with
 * smoothing off, and positions snap to that sprite's pixel grid, so the pixels stay square.
 */
import {
  BLUEME_CLOSED,
  BLUEME_OPEN,
  BLUEME_SHORT,
  BLUEME_TALL,
  EXCLAIM,
  HEART,
  HORN_BASE_ROW,
  HORN_COLUMN,
  HORN_STAGES,
  LINES,
  TAIL_TIP,
  VOYAGER_A,
  VOYAGER_B,
  ZZZ,
  buildSprite,
  hornGrid,
  speechBubble,
} from "./sprites";
import { SpaceSky } from "./sky";
import { type Range, pick, rand, snap } from "./util";

/** The painted part of each sprite, in cells, for telling when two characters overlap. */
const BLUEME_SOLID = solidBounds(BLUEME_OPEN);
const VOYAGER_SOLID = solidBounds(VOYAGER_A);

/** 藍咩 is about this fraction of the screen height. */
const BLUEME_SCREEN_FRACTION = 1 / 6;
/** 航星者 sizes relative to 藍咩's pixel scale, near layer and far layer. */
const NEAR_SCALE = 0.85;
const FAR_SCALE = 0.55;

const BLINK_GAP: Range = [2.5, 6];
const BLINK_TIME = 0.12;
const DOUBLE_BLINK_CHANCE = 0.2;
/** Seconds between the two float frames of a 航星者 (hem ripple, feet sway). */
const FLOAT_FRAME_TIME = 0.45;

/** Each 航星者 rolls for a mutation after a random wait; at most half of them grow a horn. */
const MUTATE_DELAY: Range = [20, 90];
const MUTATE_DELAY_FAST: Range = [2, 6];
const MUTATE_CHANCE = 0.6;
const HORN_STEP_TIME = 0.35;

/** 航星者 drift in pushes: a short thrust, then a long glide that slows almost to a stop. */
const GAIT_THRUST: Range = [0.6, 1.2];
const GAIT_GLIDE: Range = [2, 4];
const GAIT_THRUST_PACE = 1.5;
const GAIT_GLIDE_PACE = 0.15;

/**
 * 藍咩 roams from place to place across the whole screen: each time she weighs this many
 * candidate spots, heads for the best along a gently swaying path (radians either way), and on
 * arriving stops to look around about this often.
 */
const ROAM_CANDIDATES = 12;
const ROAM_WOBBLE = 0.35;
const ROAM_ARRIVE_PAUSE = 0.5;
/** Looking around: how long, and how often she turns the other way. */
const IDLE_TIME: Range = [3, 6];
const GLANCE_GAP: Range = [0.8, 2];
/**
 * With this many 航星者 around her for this many seconds, 藍咩 moves off somewhere roomier,
 * then not again for a while.
 */
const CROWD_COUNT = 2;
const CROWD_TIME = 3;
const CROWD_COOLDOWN = 10;
/**
 * Chance 藍咩 turns to watch a shooting star or a comet, how long she keeps looking after a
 * shooting star has gone, the longest she watches a comet, which takes half a minute to cross,
 * and how much she slows down meanwhile: she watches as she drifts, she doesn't stop.
 */
const WATCH_CHANCE = 0.75;
const WATCH_LINGER = 1;
const WATCH_COMET = 8;
const WATCH_PACE = 0.4;
/** A nap: eyes shut, a slow drift, a z every so often. */
const DOZE_TIME: Range = [20, 35];
const DOZE_PACE = 0.25;
const Z_GAP = 1.2;

/** Seconds between events, and how likely each is among those that can happen right then. */
const EVENT_GAP: Range = [15, 30];
const EVENT_GAP_FAST: Range = [3, 6];
const EVENT_WEIGHTS = { visit: 40, convoy: 35, doze: 25 };
/** A visitor gives up if it hasn't reached 藍咩 by then; once there they stay face to face this long. */
const VISIT_GIVE_UP = 20;
const VISIT_HOLD = 2.5;
const VISIT_PACE = 2.5;
/**
 * Convoy: up to this many, drawn from within this fraction of the screen width of the leader,
 * this many body widths apart. Members hurry to their places for a few seconds, then the line
 * flies off at this multiple of the leader's speed.
 */
const CONVOY_MAX = 4;
const CONVOY_REACH = 0.45;
const CONVOY_SPACING = 1.3;
const CONVOY_GATHER = 6;
const CONVOY_HURRY = 4;
const CONVOY_PACE = 2.2;
/** It breaks up after the leader has gone this many screen widths, or after this many seconds. */
const CONVOY_DISTANCE = 0.8;
const CONVOY_TIMEOUT = 30;
/** 航星者 within this fraction of the screen width may stop to stare at one growing a horn. */
const GAWK_REACH = 0.35;
const GAWK_CHANCE = 0.5;
/** A drifting 航星者 an asteroid passes close to may turn and watch it go by for a moment. */
const ASTEROID_GAWK_CHANCE = 0.3;
const ASTEROID_GAWK_TIME = 1.5;

/**
 * 藍咩 never overlaps a 航星者, and 航星者 on the same layer never overlap each other; near and
 * far 航星者 may pass over one another. Characters ease apart once the gap between them closes to
 * this share of their width, sooner when closing in fast (seconds of look-ahead), mostly up or
 * down so they slide past each other.
 */
const AVOID_ZONE = 0.25;
const AVOID_LOOKAHEAD = 1.2;
const AVOID_PUSH = 1.5;
/**
 * Round 藍咩 a 航星者 commits to one side, over or under, and pushes harder, with no sideways
 * push, so one she catches up with moves out of her way instead of being driven along ahead of
 * her. One that still hangs around her this many seconds turns and leaves.
 */
const AVOID_PUSH_BLUEME = 2.2;
const LINGER_LIMIT = 4;
/**
 * Whatever still overlaps is pushed apart, at most this fast in CSS pixels per second, so a
 * horn growing into someone eases them away. 藍咩 never gives way: if she took even part of the
 * push, 航星者 slipping underneath her would slowly shove her up against the top of the screen.
 */
const SEPARATE_MAX = 300;

/**
 * Meeting by chance: a 航星者 drifting within this share of its width of 藍咩 sets her off,
 * at most once every so often for her, and not twice in a while for the same 航星者.
 */
const MEET_REACH = 0.5;
const EXCITE_COOLDOWN = 20;
const EXCITE_COOLDOWN_FAST = 5;
const MEET_AGAIN = 60;
/** A 航星者 that has just run into 藍咩 isn't sent to visit her for this many seconds. */
const VISIT_AFTER_MEET = 20;
/** The passing 航星者 turns to look at her this long. */
const GLANCE_TIME = 1.2;
/** 藍咩's excited hops: seconds each, and how high in sprite pixels. Her face stays as it is. */
const HOP_TIME = 0.45;
const HOP_HEIGHTS = [5, 3];

/**
 * Now and then a meeting or a visit comes with a word: one bubble on screen at a time, then
 * quiet for a while. When they pass by chance the 航星者 usually does the talking; on a visit
 * it speaks first and 藍咩 may answer a moment later, which counts as one exchange.
 */
const SPEAK_GAP: Range = [20, 40];
const SPEAK_GAP_FAST: Range = [4, 8];
const SPEAK_CHANCE_MEET = 0.5;
const SPEAK_CHANCE_VISIT = 0.8;
const BLUEME_SPEAKS = 0.3;
const REPLY_CHANCE = 0.6;
const SPEAK_TIME = 1.2;
const REPLY_DELAY = 1.3;
/** A bubble's pixels against the speaker's. */
const BUBBLE_SCALE = 0.6;

/**
 *   drift   wandering about; 航星者 in thrust-and-glide pushes
 *   idle    藍咩 stopped, looking this way and that
 *   watch   藍咩 stopped, following a shooting star (phase 0) or a comet (phase 1)
 *   doze    藍咩 napping, eyes shut, barely moving
 *   greet   藍咩 stopped, facing a visitor
 *   visit   a 航星者 on its way to 藍咩 (phase 0), then face to face (phase 1)
 *   convoy  a 航星者 in a line: gathering (phase 0), then flying (phase 1)
 *   gawk    a 航星者 stopped, staring at one growing a horn or at an asteroid
 */
type Mode = "drift" | "idle" | "watch" | "doze" | "greet" | "visit" | "convoy" | "gawk";

/** What a floater wants this frame: a velocity to ease toward, and how quickly. */
interface Steer {
  vx: number;
  vy: number;
  ease: number;
  /** Keep the facing the mode set, instead of turning with the velocity. */
  hold?: boolean;
  /** How fast the float frames flip, relative to normal. */
  frames?: number;
}

interface Floater {
  kind: "blueme" | "voyager";
  /** 0 far, 1 near, 2 front. Drawn in that order. */
  layer: number;
  /** Device pixels per sprite pixel. */
  scale: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Device pixels per second. */
  speed: number;
  heading: number;
  targetHeading: number;
  wanderIn: number;
  facing: 1 | -1;
  bobClock: number;
  /** Bob height in sprite pixels; eased so a nap's slower, deeper breathing doesn't jump. */
  bobAmp: number;
  frameClock: number;
  mode: Mode;
  /** Seconds left in the current mode, or in its current phase. */
  modeLeft: number;
  phase: number;
  /** visit, greet: the one it faces. convoy: the leader, which points to itself. */
  other: Floater | null;
  /** gawk: what it stares at, a 航星者 growing a horn or an asteroid. */
  lookAt: { x: number } | null;
  /** convoy: place in line, 0 for the leader. */
  slot: number;
  /** visit: which side of 藍咩 it stops at. convoy leader: which way the line flies. */
  dir: 1 | -1;
  /** convoy leader: how far the line has flown. */
  travelled: number;
  gait: "thrust" | "glide";
  gaitLeft: number;
  /** 藍咩: where she is heading; how long she has been crowded; until she may move off from a crowd again. */
  roamTo: { x: number; y: number } | null;
  crowdTime: number;
  leaveCrowdIn: number;
  glanceIn: number;
  zIn: number;
  blinkIn: number;
  blinkLeft: number;
  blinkAgain: boolean;
  mutateIn: number;
  /** Index into HORN_STAGES, or -1 without a horn. */
  horn: number;
  hornIn: number;
  /** 藍咩: seconds into her hops, or -1 when not hopping; until she can get excited again. */
  hopClock: number;
  exciteIn: number;
  /** 航星者: until it can set 藍咩 off again; whom it is turning to look at in passing, and for how long. */
  meetIn: number;
  glanceAt: Floater | null;
  glanceLeft: number;
  /** 航星者: the side it has chosen to pass 藍咩 on, and how long it has been hanging around her. */
  detour: "over" | "under" | null;
  nearBlueme: number;
}

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  scale: number;
}

interface Emote {
  sprite: HTMLCanvasElement;
  /** Rides above this floater's head. Without one it drifts on its own, like a nap's z. */
  owner: Floater | null;
  /** A speech bubble instead: above the owner's head on this side, its tail pointing back down. */
  bubble?: { line: string; side: number };
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Starts below zero for one that waits its turn, and isn't drawn until then. */
  age: number;
  life: number;
  scale: number;
}

export interface SpaceOptions {
  /** Number of 航星者; by default it follows the screen area. */
  voyagers?: number;
  /** Mutate within seconds instead of a minute or so, for checking the horn. */
  fastMutation?: boolean;
  /** Events every few seconds instead of every 15–30, and comets and asteroids far more often. */
  fastEvents?: boolean;
}

export class SpaceScene {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprites = {
    open: buildSprite(BLUEME_OPEN),
    closed: buildSprite(BLUEME_CLOSED),
    tall: buildSprite(BLUEME_TALL),
    short: buildSprite(BLUEME_SHORT),
    floatA: buildSprite(VOYAGER_A),
    floatB: buildSprite(VOYAGER_B),
    horns: HORN_STAGES.map((h) => buildSprite(hornGrid(h))),
    heart: buildSprite(HEART),
    exclaim: buildSprite(EXCLAIM),
    zzz: buildSprite(ZZZ),
    /** Each line in a bubble with its tail on the left end, and on the right. */
    bubbles: new Map(
      [...LINES.blueme, ...LINES.voyager].map((line) => [
        line,
        { left: buildSprite(speechBubble(line, "left")), right: buildSprite(speechBubble(line, "right")) },
      ]),
    ),
  };
  private width = 0;
  private height = 0;
  private dpr = 1;
  /** 藍咩's pixel scale; everything else is sized from it. */
  private unit = 1;
  private readonly sky: SpaceSky;
  private floaters: Floater[] = [];
  private blueme!: Floater;
  private sparkles: Sparkle[] = [];
  private emotes: Emote[] = [];
  private eventIn: number;
  /** So the same 航星者 doesn't drop by twice in a row. */
  private lastVisitor: Floater | null = null;
  /** Seconds 藍咩 has spent in each cell of a 3×3 grid over the screen, so she roams to fresh ones. */
  private visited = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  /** Seconds until anyone may speak again. */
  private speakIn = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: SpaceOptions = {},
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.eventIn = this.eventGap();
    this.sky = new SpaceSky({ fast: options.fastEvents });
    this.sky.onMeteor = () => this.startWatch(0);
    this.sky.onComet = () => this.startWatch(1);
  }

  resize(cssWidth: number, cssHeight: number, dpr: number) {
    const oldW = this.width;
    const oldH = this.height;
    this.dpr = dpr;
    this.width = Math.round(cssWidth * dpr);
    this.height = Math.round(cssHeight * dpr);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.unit = Math.max(2, Math.round((this.height * BLUEME_SCREEN_FRACTION) / BLUEME_OPEN.length));

    this.sky.resize(this.width, this.height, dpr, this.unit);

    if (this.floaters.length === 0) {
      this.floaters = this.makeFloaters(cssWidth * cssHeight);
      // Nobody starts on top of anybody.
      for (let i = 0; i < 20; i++) this.resolveOverlaps(1);
    } else {
      // Keep everyone where they were, proportionally, at the new pixel scale.
      for (const f of this.floaters) {
        f.x *= this.width / oldW;
        f.y *= this.height / oldH;
        f.scale = this.scaleFor(f.layer);
        f.speed *= this.height / oldH;
        f.roamTo = null;
      }
    }
  }

  step(dt: number) {
    this.sky.step(dt);
    this.speakIn -= dt;
    this.stepDirector(dt);
    for (const f of this.floaters) this.stepFloater(f, dt);
    this.resolveOverlaps(dt);
    this.noticeAsteroids();
    this.noticeEncounters();
    this.noticeCrowd(dt);

    for (const s of this.sparkles) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
    }
    this.sparkles = this.sparkles.filter((s) => s.life > 0);
    for (const e of this.emotes) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.age += dt;
    }
    this.emotes = this.emotes.filter((e) => e.age < e.life);
  }

  render() {
    this.sky.renderBack(this.ctx);
    for (const f of this.floaters) this.drawFloater(f);
    this.drawSparkles();
    this.sky.renderFront(this.ctx);
    this.drawEmotes();
  }

  // ---------------------------------------------------------------- floaters

  private scaleFor(layer: number) {
    if (layer === 2) return this.unit;
    return Math.max(layer === 1 ? 2 : 1, Math.round(this.unit * (layer === 1 ? NEAR_SCALE : FAR_SCALE)));
  }

  private makeFloaters(cssArea: number): Floater[] {
    const count = this.options.voyagers ?? Math.min(7, Math.max(4, Math.round(cssArea / 300_000)));
    const floaters: Floater[] = [];
    for (let i = 0; i < count; i++) {
      // About two in five drift further back. Start spread across the width, not in a clump.
      const f = this.makeFloater("voyager", i % 5 < 2 ? 0 : 1);
      f.x = ((i + rand([0.2, 0.8])) / count) * this.width;
      floaters.push(f);
    }
    this.blueme = this.makeFloater("blueme", 2);
    floaters.push(this.blueme);
    return floaters.sort((a, b) => a.layer - b.layer);
  }

  private makeFloater(kind: Floater["kind"], layer: number): Floater {
    const css = this.dpr;
    const speed = (layer === 0 ? rand([10, 18]) : layer === 1 ? rand([18, 30]) : rand([14, 22])) * css;
    const heading = (Math.random() < 0.5 ? 0 : Math.PI) + rand([-0.4, 0.4]);
    return {
      kind,
      layer,
      scale: this.scaleFor(layer),
      x: rand([0.1, 0.9]) * this.width,
      y: rand([0.15, 0.85]) * this.height,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed * 0.5,
      speed,
      heading,
      targetHeading: heading,
      wanderIn: rand([2, 5]),
      facing: Math.cos(heading) >= 0 ? 1 : -1,
      bobClock: rand([0, Math.PI * 2]),
      bobAmp: 2,
      frameClock: rand([0, FLOAT_FRAME_TIME * 2]),
      mode: "drift",
      modeLeft: 0,
      phase: 0,
      other: null,
      lookAt: null,
      slot: 0,
      dir: 1,
      travelled: 0,
      gait: Math.random() < 0.3 ? "thrust" : "glide",
      gaitLeft: rand(GAIT_GLIDE),
      roamTo: null,
      crowdTime: 0,
      leaveCrowdIn: 0,
      glanceIn: 0,
      zIn: 0,
      blinkIn: rand(BLINK_GAP),
      blinkLeft: 0,
      blinkAgain: false,
      mutateIn: rand(this.options.fastMutation ? MUTATE_DELAY_FAST : MUTATE_DELAY),
      horn: -1,
      hornIn: 0,
      hopClock: -1,
      exciteIn: 0,
      meetIn: 0,
      glanceAt: null,
      glanceLeft: 0,
      detour: null,
      nearBlueme: 0,
    };
  }

  private spriteSize(f: Floater) {
    const sprite = f.kind === "blueme" ? this.sprites.open : this.sprites.floatA;
    return { w: sprite.width * f.scale, h: sprite.height * f.scale };
  }

  private stepFloater(f: Floater, dt: number) {
    f.modeLeft -= dt;
    const steer = this.steer(f, dt);
    const { ax, ay } = this.avoid(f);
    let dx = steer.vx + ax;
    let dy = steer.vy + ay;

    // Soft edges: drift back toward the middle instead of bouncing.
    const { w, h } = this.spriteSize(f);
    const marginY = h * 0.6;
    if (f.y < marginY) dy += f.speed * (1 - f.y / marginY);
    if (f.y > this.height - marginY) dy -= f.speed * (1 - (this.height - f.y) / marginY);
    // 藍咩 stays on screen; where she goes is up to her roaming, which keeps to the safe area.
    if (f.kind === "blueme") {
      const marginX = w;
      if (f.x < marginX) dx += f.speed * 1.5 * (1 - f.x / marginX);
      if (f.x > this.width - marginX) dx -= f.speed * 1.5 * (1 - (this.width - f.x) / marginX);
    }

    const ease = Math.min(1, dt * steer.ease);
    f.vx += (dx - f.vx) * ease;
    f.vy += (dy - f.vy) * ease;
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    // 航星者 drift off one side and come back on the other.
    if (f.kind === "voyager") {
      if (f.x < -w) f.x = this.width + w * 0.5;
      else if (f.x > this.width + w) f.x = -w * 0.5;
    }

    // Turn around only once clearly moving the other way, so it never flickers.
    if (!steer.hold) {
      if (f.vx > f.speed * 0.15) f.facing = 1;
      else if (f.vx < -f.speed * 0.15) f.facing = -1;
    }
    // A 航星者 that has just passed 藍咩 looks round at her, whatever it is doing.
    if (f.glanceLeft > 0) {
      f.glanceLeft -= dt;
      f.facing = this.wrapDx(f, f.glanceAt!.x) >= 0 ? 1 : -1;
    }

    const dozing = f.mode === "doze";
    f.bobClock += dt * (dozing ? 0.7 : 1.3);
    f.bobAmp += ((dozing ? 3 : 2) - f.bobAmp) * Math.min(1, dt);
    f.frameClock += dt * (steer.frames ?? 1);
    f.exciteIn -= dt;
    f.meetIn -= dt;
    if (f.kind === "blueme") {
      this.stepBlink(f, dt);
      this.stepHop(f, dt);
    } else {
      this.stepMutation(f, dt);
    }
  }

  // ---------------------------------------------------------------- excitement

  /** 藍咩 hops twice, usually with a heart over her head. */
  private excite(b: Floater, heart = true) {
    b.hopClock = 0;
    b.exciteIn = this.options.fastEvents ? EXCITE_COOLDOWN_FAST : EXCITE_COOLDOWN;
    if (heart) this.emote(b, this.sprites.heart, 1.6);
  }

  private stepHop(f: Floater, dt: number) {
    if (f.hopClock < 0) return;
    f.hopClock += dt;
    if (f.hopClock >= HOP_TIME * HOP_HEIGHTS.length) f.hopClock = -1;
  }

  /**
   * Where 藍咩 is in a hop: how high off her usual place (sprite pixels) and which shape. Each hop
   * crouches (squashed), springs up (stretched), sails in her usual shape, comes down stretched
   * and lands squashed.
   */
  private hopPose(f: Floater): { lift: number; shape: "short" | "tall" | "round" } {
    if (f.hopClock < 0) return { lift: 0, shape: "round" };
    const i = Math.min(HOP_HEIGHTS.length - 1, Math.floor(f.hopClock / HOP_TIME));
    const t = f.hopClock / HOP_TIME - i;
    const air = Math.min(1, Math.max(0, (t - 0.12) / 0.8));
    const lift = Math.round(4 * HOP_HEIGHTS[i] * air * (1 - air));
    const shape = t < 0.12 || t >= 0.92 ? "short" : t < 0.3 || t >= 0.8 ? "tall" : "round";
    return { lift, shape };
  }

  /**
   * A 航星者 drifting close past 藍咩 sets her off: she hops with a heart, and it looks round at
   * her with a heart of its own, carrying on with whatever it was doing.
   */
  private noticeEncounters() {
    const b = this.blueme;
    if (!b || b.exciteIn > 0 || !(b.mode === "drift" || b.mode === "idle" || b.mode === "greet")) return;
    for (const f of this.floaters) {
      if (f.kind !== "voyager" || f.meetIn > 0 || f.mode === "visit") continue;
      const g = this.gaps(b, f);
      const reach = this.spriteSize(f).w * MEET_REACH;
      if (g.x >= reach || g.y >= reach) continue;
      this.excite(b);
      this.meet(f, b);
      if (Math.random() < SPEAK_CHANCE_MEET) {
        if (Math.random() < BLUEME_SPEAKS) this.converse(b, f, false);
        else this.converse(f, b, false);
      }
      return;
    }
  }

  /** `f` has just met 藍咩: it won't set her off again for a while, and it looks at her. */
  private meet(f: Floater, b: Floater) {
    f.meetIn = MEET_AGAIN;
    f.glanceAt = b;
    f.glanceLeft = GLANCE_TIME;
    this.emote(f, this.sprites.heart, 1.4);
  }

  /** Runs the floater's mode for this frame, switching modes when one is over. */
  private steer(f: Floater, dt: number): Steer {
    const stop = (ease = 1.2): Steer => ({ vx: 0, vy: 0, ease, hold: true });
    switch (f.mode) {
      case "drift":
        // Arrived somewhere: half the time 藍咩 stops to look around before moving on.
        if (f.kind === "blueme" && this.arrived(f)) {
          f.roamTo = null;
          if (Math.random() < ROAM_ARRIVE_PAUSE) {
            this.setMode(f, "idle", rand(IDLE_TIME));
            f.glanceIn = rand(GLANCE_GAP);
            return stop();
          }
        }
        return this.drift(f, dt);

      case "idle":
        if (f.modeLeft <= 0) break;
        f.glanceIn -= dt;
        if (f.glanceIn <= 0) {
          f.glanceIn = rand(GLANCE_GAP);
          f.facing = f.facing > 0 ? -1 : 1;
        }
        return stop();

      case "watch": {
        // A shooting star is watched until it's gone; a comet only for a while, it's slow.
        const target = f.phase === 1 ? this.sky.comet : this.sky.meteor;
        if (target) f.facing = target.x >= f.x ? 1 : -1;
        if (target && f.phase === 0) {
          f.modeLeft = WATCH_LINGER;
        } else if (f.modeLeft <= 0) {
          // Two quick blinks, as if to say "did you see that".
          f.blinkLeft = BLINK_TIME;
          f.blinkAgain = true;
          f.blinkIn = 0.15;
          break;
        }
        // She keeps drifting, slower, looking its way all the while.
        const s = this.drift(f, dt);
        return { ...s, vx: s.vx * WATCH_PACE, vy: s.vy * WATCH_PACE, hold: true };
      }

      case "doze": {
        if (f.modeLeft <= 0) break;
        f.zIn -= dt;
        if (f.zIn <= 0) {
          f.zIn = Z_GAP;
          this.puffZ(f);
        }
        const s = this.drift(f, dt);
        return { ...s, vx: s.vx * DOZE_PACE, vy: s.vy * DOZE_PACE };
      }

      case "greet":
        if (f.modeLeft <= 0) break;
        f.facing = f.other!.x >= f.x ? 1 : -1;
        return stop();

      case "visit":
        return this.stepVisit(f, dt);

      case "convoy":
        return this.stepConvoy(f, dt) ?? this.drift(f, dt);

      case "gawk":
        if (f.modeLeft <= 0) break;
        f.facing = this.wrapDx(f, f.lookAt!.x) >= 0 ? 1 : -1;
        return stop(0.8);
    }
    this.toDrift(f);
    return this.drift(f, dt);
  }

  private setMode(f: Floater, mode: Mode, time: number, other: Floater | null = null) {
    f.mode = mode;
    f.modeLeft = time;
    f.phase = 0;
    f.other = other;
    f.lookAt = null;
  }

  /** Back to wandering, optionally off in a new direction. */
  private toDrift(f: Floater, heading = f.heading) {
    this.setMode(f, "drift", 0);
    f.heading = f.targetHeading = heading;
    f.wanderIn = rand([2, 6]);
    if (f.kind === "voyager") {
      f.gait = "thrust";
      f.gaitLeft = rand(GAIT_THRUST);
    }
  }

  /**
   * Wandering. 藍咩 roams from spot to spot; a 航星者 takes a new heading near the current one
   * every few seconds, kept mostly sideways.
   */
  private drift(f: Floater, dt: number): Steer {
    if (f.kind === "blueme") return this.roam(f, dt);
    f.wanderIn -= dt;
    if (f.wanderIn <= 0) {
      f.wanderIn = rand([2, 6]);
      const side = Math.cos(f.heading) >= 0 ? 0 : Math.PI;
      f.targetHeading = side + rand([-0.55, 0.55]);
      if (Math.random() < 0.12) f.targetHeading += Math.PI; // the occasional change of mind
    }
    f.heading += angleDiff(f.targetHeading, f.heading) * Math.min(1, dt * 0.6);
    const vx = Math.cos(f.heading) * f.speed;
    const vy = Math.sin(f.heading) * f.speed * 0.5;

    // 航星者 push off, then glide: a quick pick-up with the hem flapping, a slow coast.
    f.gaitLeft -= dt;
    if (f.gaitLeft <= 0) {
      f.gait = f.gait === "thrust" ? "glide" : "thrust";
      f.gaitLeft = rand(f.gait === "thrust" ? GAIT_THRUST : GAIT_GLIDE);
    }
    return f.gait === "thrust"
      ? { vx: vx * GAIT_THRUST_PACE, vy: vy * GAIT_THRUST_PACE, ease: 2.5, frames: 1.8 }
      : { vx: vx * GAIT_GLIDE_PACE, vy: vy * GAIT_GLIDE_PACE, ease: 0.5, frames: 0.6 };
  }

  // ---------------------------------------------------------------- roaming

  /**
   * 藍咩 heads for her chosen spot along a gently swaying path, easing off as she gets close,
   * and picks the next spot once there.
   */
  private roam(f: Floater, dt: number): Steer {
    if (!f.roamTo || this.arrived(f)) f.roamTo = this.pickRoamTarget(f);
    const dx = f.roamTo.x - f.x;
    const dy = f.roamTo.y - f.y;
    f.targetHeading = Math.atan2(dy, dx) + Math.sin(f.frameClock * 0.4) * ROAM_WOBBLE;
    f.heading += angleDiff(f.targetHeading, f.heading) * Math.min(1, dt * 0.6);
    const pace = Math.max(0.3, Math.min(1, Math.hypot(dx, dy) / (1.5 * this.spriteSize(f).w)));
    return { vx: Math.cos(f.heading) * f.speed * pace, vy: Math.sin(f.heading) * f.speed * pace, ease: 0.8 };
  }

  private arrived(f: Floater) {
    return !!f.roamTo && Math.hypot(f.roamTo.x - f.x, f.roamTo.y - f.y) < this.spriteSize(f).w / 2;
  }

  /** Which ninth of the screen a point is in, row by row. */
  private cellOf(x: number, y: number) {
    const col = Math.min(2, Math.max(0, Math.floor((x / this.width) * 3)));
    const row = Math.min(2, Math.max(0, Math.floor((y / this.height) * 3)));
    return row * 3 + col;
  }

  /**
   * Somewhere to roam to, the best of a few random spots in the safe area: a fair way off but
   * not across the whole screen, away from 航星者, and in a part of the screen she has spent
   * little time in. Moving off from a crowd, room counts double and the spot must be well away.
   */
  private pickRoamTarget(f: Floater, awayFromCrowd = false) {
    const { w, h } = this.spriteSize(f);
    const x0 = w;
    const x1 = this.width - w;
    const y0 = h * 0.8;
    const y1 = this.height - h * 0.8;
    const diagonal = Math.hypot(this.width, this.height);
    const most = Math.max(1, ...this.visited);
    const voyagers = this.floaters.filter((o) => o.kind === "voyager");
    let best = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    let bestScore = -Infinity;
    for (let i = 0; i < ROAM_CANDIDATES; i++) {
      const x = rand([x0, x1]);
      const y = rand([y0, y1]);
      const d = Math.hypot(x - f.x, y - f.y);
      if (awayFromCrowd && d < this.width * 0.35) continue;
      // Short hops between neighbouring parts of the screen; long trips would keep cutting
      // across the middle, and she'd spend half her time there.
      const share = d / diagonal;
      const distance = share < 0.2 ? share / 0.2 : share > 0.45 ? Math.max(0, 1 - (share - 0.45) / 0.3) : 1;
      const nearest = Math.min(Infinity, ...voyagers.map((o) => Math.hypot(o.x - x, o.y - y)));
      const room = Math.min(1, nearest / (3 * w));
      const fresh = 1 - this.visited[this.cellOf(x, y)] / most;
      const score = distance + room * (awayFromCrowd ? 2 : 1) + fresh * 1.5;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
    return best;
  }

  /**
   * Keeps track of where 藍咩 spends her time, and of 航星者 hanging around her: one that
   * lingers too long turns and leaves, and if a few crowd her for a while she moves off
   * somewhere roomier herself.
   */
  private noticeCrowd(dt: number) {
    const b = this.blueme;
    if (!b) return;
    this.visited[this.cellOf(b.x, b.y)] += dt;
    b.leaveCrowdIn -= dt;
    let around = 0;
    // Which way the crowd is, from her.
    let towardX = 0;
    let towardY = 0;
    for (const f of this.floaters) {
      if (f.kind !== "voyager") continue;
      const g = this.gaps(b, f);
      const w = this.spriteSize(f).w;
      const near = g.x < w && g.y < w;
      if (near) {
        around++;
        towardX -= this.wrapDx(f, b.x);
        towardY += f.y - b.y;
      }
      // Visitors and 航星者 turning to look at her are meant to be there.
      f.nearBlueme = near && f.mode === "drift" && f.glanceLeft <= 0 ? f.nearBlueme + dt : 0;
      if (f.nearBlueme > LINGER_LIMIT) {
        // Off it goes, straight away from her.
        this.toDrift(f, Math.atan2(f.y - b.y, -this.wrapDx(f, b.x)));
        f.nearBlueme = 0;
      }
    }
    b.crowdTime = around >= CROWD_COUNT ? b.crowdTime + dt : 0;
    if (b.crowdTime > CROWD_TIME && b.leaveCrowdIn <= 0 && (b.mode === "drift" || b.mode === "idle")) {
      // Already on her way somewhere away from them: she just carries on. Picking a new spot
      // every time would have her zigzag and never get anywhere.
      const leaving = b.roamTo && (b.roamTo.x - b.x) * towardX + (b.roamTo.y - b.y) * towardY < 0;
      if (!leaving || b.mode === "idle") {
        b.roamTo = this.pickRoamTarget(b, true);
        if (b.mode === "idle") this.toDrift(b);
      }
      b.leaveCrowdIn = CROWD_COOLDOWN;
      b.crowdTime = 0;
    }
  }

  /**
   * Horizontal offset from `f` to `x`. 航星者 leave one side and come back on the other, so
   * for them it is the short way round: what is just off the right edge is just behind the left.
   */
  private wrapDx(f: Floater, x: number) {
    const dx = x - f.x;
    if (f.kind !== "voyager") return dx;
    const period = this.width + 1.5 * this.spriteSize(f).w;
    return dx - Math.round(dx / period) * period;
  }

  private stepBlink(f: Floater, dt: number) {
    // blinkIn only counts down while the eyes are open.
    if (f.blinkLeft > 0) {
      f.blinkLeft -= dt;
      return;
    }
    f.blinkIn -= dt;
    if (f.blinkIn > 0) return;
    f.blinkLeft = BLINK_TIME;
    if (!f.blinkAgain && Math.random() < DOUBLE_BLINK_CHANCE) {
      f.blinkAgain = true;
      f.blinkIn = 0.15;
    } else {
      f.blinkAgain = false;
      f.blinkIn = rand(BLINK_GAP);
    }
  }

  private stepMutation(f: Floater, dt: number) {
    if (f.horn < 0) {
      f.mutateIn -= dt;
      if (f.mutateIn > 0) return;
      const voyagers = this.floaters.filter((o) => o.kind === "voyager");
      const horned = voyagers.filter((o) => o.horn >= 0).length;
      if (horned < Math.ceil(voyagers.length / 2) && Math.random() < MUTATE_CHANCE) {
        f.horn = 0;
        f.hornIn = HORN_STEP_TIME;
        this.sparkleAtHorn(f);
        this.gatherGawkers(f);
      } else {
        f.mutateIn = rand(this.options.fastMutation ? MUTATE_DELAY_FAST : MUTATE_DELAY);
      }
      return;
    }
    if (f.horn >= HORN_STAGES.length - 1) return;
    f.hornIn -= dt;
    if (f.hornIn > 0) return;
    f.horn++;
    f.hornIn = HORN_STEP_TIME;
    this.sparkleAtHorn(f);
  }

  /** Some of the 航星者 nearby stop and stare until the horn is fully grown. */
  private gatherGawkers(horned: Floater) {
    const time = (HORN_STAGES.length - 1) * HORN_STEP_TIME + 1;
    for (const o of this.floaters) {
      if (o === horned || o.kind !== "voyager" || o.layer !== horned.layer || o.mode !== "drift") continue;
      if (Math.abs(this.wrapDx(o, horned.x)) > this.width * GAWK_REACH) continue;
      if (Math.random() < GAWK_CHANCE) {
        this.setMode(o, "gawk", time);
        o.lookAt = horned;
      }
    }
  }

  /**
   * An asteroid passing close behind a drifting 航星者 may make it turn and watch. Each asteroid
   * gets one chance, with the first one it comes near.
   */
  private noticeAsteroids() {
    for (const a of this.sky.asteroids) {
      if (a.noticed) continue;
      for (const f of this.floaters) {
        if (f.kind !== "voyager" || f.mode !== "drift") continue;
        if (Math.hypot(a.x - f.x, a.y - f.y) > this.spriteSize(f).w) continue;
        a.noticed = true;
        if (Math.random() < ASTEROID_GAWK_CHANCE) {
          this.setMode(f, "gawk", ASTEROID_GAWK_TIME);
          f.lookAt = a;
        }
        break;
      }
    }
  }

  /** 藍咩 may stop to watch a shooting star (0) or a comet (1) that has just appeared. */
  private startWatch(kind: 0 | 1) {
    const b = this.blueme;
    if (!b || !(b.mode === "drift" || b.mode === "idle" || b.mode === "doze")) return;
    if (Math.random() >= WATCH_CHANCE) return;
    this.wake(b);
    this.setMode(b, "watch", kind === 1 ? WATCH_COMET : WATCH_LINGER);
    b.phase = kind;
  }

  // ---------------------------------------------------------------- events

  private eventGap() {
    return rand(this.options.fastEvents ? EVENT_GAP_FAST : EVENT_GAP);
  }

  /** Every so often starts one of the events that can happen right now, picked by weight. */
  private stepDirector(dt: number) {
    this.eventIn -= dt;
    if (this.eventIn > 0 || !this.blueme) return;
    this.eventIn = this.eventGap();

    const b = this.blueme;
    const events: [number, () => void][] = [];
    const visitor = this.pickVisitor();
    const visiting = this.floaters.some((f) => f.mode === "visit");
    if (visitor && !visiting && (b.mode === "drift" || b.mode === "idle" || b.mode === "doze")) {
      events.push([EVENT_WEIGHTS.visit, () => this.startVisit(visitor)]);
    }
    const line = this.pickConvoy();
    if (line) events.push([EVENT_WEIGHTS.convoy, () => this.startConvoy(line)]);
    if (b.mode === "drift" || b.mode === "idle") {
      events.push([
        EVENT_WEIGHTS.doze,
        () => {
          this.setMode(b, "doze", rand(DOZE_TIME));
          b.zIn = 0.5;
        },
      ]);
    }
    pickWeighted(events)?.();
  }

  /** Opens 藍咩's eyes with a start, if it was napping. */
  private wake(b: Floater) {
    if (b.mode !== "doze") return;
    this.emote(b, this.sprites.exclaim, 1);
  }

  /**
   * The nearest drifting 航星者 on the near layer, other than the last visitor if there's a choice,
   * and not one that has only just run into her.
   */
  private pickVisitor() {
    const b = this.blueme;
    const free = this.floaters.filter(
      (f) => f.kind === "voyager" && f.layer === 1 && f.mode === "drift" && f.meetIn < MEET_AGAIN - VISIT_AFTER_MEET,
    );
    let best: Floater | null = null;
    for (const f of free) {
      if (f === this.lastVisitor && free.length > 1) continue;
      if (!best || Math.abs(this.wrapDx(f, b.x)) < Math.abs(this.wrapDx(best, b.x))) best = f;
    }
    return best;
  }

  private startVisit(v: Floater) {
    this.setMode(v, "visit", VISIT_GIVE_UP, this.blueme);
    this.lastVisitor = v;
    // Stop on the side it comes from.
    v.dir = this.wrapDx(v, this.blueme.x) > 0 ? -1 : 1;
  }

  /** Heads for a spot beside 藍咩, stays face to face for a moment, then leaves. */
  private stepVisit(f: Floater, dt: number): Steer {
    const b = f.other!;
    if (f.phase === 1) {
      f.facing = b.x >= f.x ? 1 : -1;
      if (f.modeLeft > 0) return { vx: 0, vy: 0, ease: 1.5, hold: true };
      // Off it goes, away from 藍咩.
      this.toDrift(f, f.dir > 0 ? rand([-0.3, 0.3]) : Math.PI + rand([-0.3, 0.3]));
      return this.drift(f, dt);
    }
    if (f.modeLeft <= 0) {
      this.toDrift(f);
      return this.drift(f, dt);
    }
    const bw = this.spriteSize(b).w;
    const fw = this.spriteSize(f).w;
    const gap = (bw + fw) / 2 + 2 * f.scale;
    // Stop on whichever side of 藍咩 it is on, unless that spot is off screen.
    const offScreen = (side: number) => b.x + side * gap < fw / 2 || b.x + side * gap > this.width - fw / 2;
    const onRight = this.wrapDx(f, b.x) < 0;
    f.dir = onRight ? 1 : -1;
    if (offScreen(f.dir)) f.dir = onRight ? -1 : 1;
    const spotX = b.x + f.dir * gap;
    // Level with 藍咩, but not so near an edge that the soft edges keep pushing it back.
    const margin = this.spriteSize(f).h * 0.6;
    const spotY = Math.min(this.height - margin, Math.max(margin, b.y));

    // She blocks the way, and she doesn't budge, so it goes round her: from the far side, over
    // or under her first; from above or below, out to the side first, then down or up to her.
    let tx = spotX;
    let ty = spotY;
    const g = this.gaps(f, b);
    const space = 2 * f.scale;
    if ((onRight ? 1 : -1) !== f.dir) {
      const bb = this.box(b);
      const tall = this.box(f).bottom - this.box(f).top;
      const roomAbove = bb.top - tall - space >= 0;
      const roomBelow = bb.bottom + tall + space <= this.height;
      const over = roomAbove && (f.y < b.y || !roomBelow);
      ty = over ? bb.top - tall / 2 - 2 * space : bb.bottom + tall / 2 + 2 * space;
    } else if (g.x < space && g.y >= -space) {
      ty = f.y;
    }
    const dx = this.wrapDx(f, tx);
    const dy = ty - f.y;
    if (tx === spotX && ty === spotY && Math.hypot(dx, dy) < 3 * f.scale) {
      f.phase = 1;
      f.modeLeft = VISIT_HOLD;
      // Woken from a nap she gets a "!" instead of a heart, so the two don't sit on top of each other.
      const napping = b.mode === "doze";
      this.wake(b);
      this.setMode(b, "greet", VISIT_HOLD + 0.5, f);
      this.excite(b, !napping);
      this.emote(f, this.sprites.heart, VISIT_HOLD);
      if (Math.random() < SPEAK_CHANCE_VISIT) this.converse(f, b, Math.random() < REPLY_CHANCE);
      // Leaving again later shouldn't count as running into her by chance.
      f.meetIn = MEET_AGAIN;
    }
    return seek(dx, dy, f.speed * VISIT_PACE, 1.5);
  }

  /** The drifting 航星者 of whichever layer has most of them: a leader near the middle and its nearest neighbours. */
  private pickConvoy(): Floater[] | null {
    let free: Floater[] = [];
    for (const layer of [0, 1]) {
      const here = this.floaters.filter((f) => f.kind === "voyager" && f.layer === layer && f.mode === "drift");
      if (here.length > free.length) free = here;
    }
    if (free.length < 2) return null;
    const mid = this.width / 2;
    const leader = free.reduce((a, b) => (Math.abs(a.x - mid) <= Math.abs(b.x - mid) ? a : b));
    const away = (f: Floater) => Math.abs(this.wrapDx(leader, f.x));
    const rest = free
      .filter((f) => f !== leader && away(f) < this.width * CONVOY_REACH)
      .sort((a, b) => away(a) - away(b));
    return rest.length ? [leader, ...rest.slice(0, CONVOY_MAX - 1)] : null;
  }

  private startConvoy(line: Floater[]) {
    const leader = line[0];
    leader.dir = leader.facing;
    leader.travelled = 0;
    line.forEach((f, i) => {
      this.setMode(f, "convoy", CONVOY_TIMEOUT, leader);
      f.slot = i;
    });
  }

  /** Where member `f` belongs: behind the leader, every other one a little higher or lower. */
  private convoySpot(f: Floater, leader: Floater) {
    const { w, h } = this.spriteSize(f);
    const k = f.slot;
    return {
      x: leader.x - leader.dir * k * CONVOY_SPACING * w,
      y: leader.y + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.25 * h,
    };
  }

  /** The leader gathers the line and then flies it straight across; undefined once it breaks up. */
  private stepConvoy(f: Floater, dt: number): Steer | undefined {
    const leader = f.other!;
    if (leader.mode !== "convoy") {
      this.toDrift(f);
      return undefined;
    }
    if (f === leader) {
      const members = this.floaters.filter((o) => o !== f && o.mode === "convoy" && o.other === f);
      if (f.phase === 0) {
        const gathered = members.every((o) => {
          const spot = this.convoySpot(o, f);
          return Math.hypot(this.wrapDx(o, spot.x), spot.y - o.y) < 0.6 * this.spriteSize(o).w;
        });
        if (gathered || CONVOY_TIMEOUT - f.modeLeft > CONVOY_GATHER) f.phase = 1;
        f.facing = f.dir;
        return { vx: f.dir * f.speed * 0.2, vy: 0, ease: 1, hold: true };
      }
      f.travelled += Math.abs(f.vx) * dt;
      if (f.travelled > CONVOY_DISTANCE * this.width || f.modeLeft <= 0) {
        // Break up and scatter, each a little off the line's heading.
        const heading = f.dir > 0 ? 0 : Math.PI;
        for (const o of [f, ...members]) this.toDrift(o, heading + rand([-0.6, 0.6]));
        return undefined;
      }
      f.facing = f.dir;
      return { vx: f.dir * f.speed * CONVOY_PACE, vy: Math.sin(f.bobClock * 0.4) * f.speed * 0.1, ease: 0.8, hold: true };
    }

    // A member chases its spot, carried along by the leader's own speed so it keeps up.
    const spot = this.convoySpot(f, leader);
    const s = seek(this.wrapDx(f, spot.x), spot.y - f.y, f.speed * (leader.phase === 0 ? CONVOY_HURRY : 2), 1.5);
    s.vx += leader.vx;
    s.vy += leader.vy;
    if (leader.phase === 1) {
      f.facing = leader.dir;
      s.hold = true;
    }
    return s;
  }

  // ---------------------------------------------------------------- emotes

  private emote(owner: Floater, sprite: HTMLCanvasElement, life: number) {
    this.emotes.push({ sprite, owner, x: 0, y: 0, vx: 0, vy: 0, age: 0, life, scale: owner.scale });
  }

  /**
   * `f` says its line to `to`, and with `reply` `to` answers a moment later; then nobody speaks
   * for a while. Nothing is said while another bubble is up or about to be.
   */
  private converse(f: Floater, to: Floater, reply: boolean) {
    if (this.speakIn > 0 || this.emotes.some((e) => e.bubble)) return;
    this.speakIn = rand(this.options.fastEvents ? SPEAK_GAP_FAST : SPEAK_GAP);
    this.say(f, to, 0);
    if (reply) this.say(to, f, REPLY_DELAY);
  }

  /** A bubble over `f`'s head on the side away from `to`, so it covers neither face. */
  private say(f: Floater, to: Floater, delay: number) {
    const line = pick(f.kind === "blueme" ? LINES.blueme : LINES.voyager);
    // Only 航星者 wrap around the screen, so measure the short way round from whichever one is.
    const away = to.kind === "voyager" ? this.wrapDx(to, f.x) : -this.wrapDx(f, to.x);
    this.emotes.push({
      sprite: this.sprites.bubbles.get(line)!.left,
      owner: f,
      bubble: { line, side: away >= 0 ? 1 : -1 },
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: -delay,
      life: SPEAK_TIME,
      scale: Math.max(2, Math.round(f.scale * BUBBLE_SCALE)),
    });
  }

  /**
   * Where a bubble goes: its tail tip a quarter of the way in from that side of the head, the
   * bubble reaching outward from there. It swaps sides rather than run off the screen.
   */
  private bubblePlace(e: Emote, p: { left: number; top: number; w: number }, pop: number) {
    const { line, side } = e.bubble!;
    const sprites = this.sprites.bubbles.get(line)!;
    const s = e.scale;
    const w = sprites.left.width * s;
    const h = sprites.left.height * s;
    const at = (side: number) => {
      const tip = p.left + p.w / 2 + (side * p.w) / 4;
      // Out to the right, the tail is on the bubble's left end, and the other way round.
      const x = side > 0 ? tip - (TAIL_TIP + 0.5) * s : tip - w + (TAIL_TIP + 0.5) * s;
      return { sprite: side > 0 ? sprites.left : sprites.right, x };
    };
    let place = at(side);
    if (place.x < 0 || place.x + w > this.width) place = at(-side);
    const x = Math.min(Math.max(0, place.x), this.width - w);
    const y = Math.max(0, p.top - h - pop * s);
    return { sprite: place.sprite, x, y, w, h };
  }

  /** A z rising from the top of a napping 藍咩's head, on the side it faces. */
  private puffZ(f: Floater) {
    const { left, top, w } = this.placement(f);
    const scale = Math.max(1, Math.round(f.scale * 0.6));
    this.emotes.push({
      sprite: this.sprites.zzz,
      owner: null,
      x: left + (f.facing > 0 ? 0.8 : 0.2) * w,
      y: top,
      vx: f.facing * 6 * this.dpr,
      vy: -20 * this.dpr,
      age: 0,
      life: 1.8,
      scale,
    });
  }

  private drawEmotes() {
    const ctx = this.ctx;
    for (const e of this.emotes) {
      if (e.age < 0) continue;
      const left = e.life - e.age;
      // Blink out at the end, like the sparkles.
      if (left < 0.3 && Math.floor(left * 12) % 2) continue;
      if (e.bubble && e.owner) {
        // Pops up one pixel higher for a moment, like the other signs.
        const b = this.bubblePlace(e, this.placement(e.owner), e.age < 0.15 ? 2 : 1);
        ctx.drawImage(b.sprite, snap(b.x, e.scale), snap(b.y, e.scale), b.w, b.h);
        continue;
      }
      const w = e.sprite.width * e.scale;
      const h = e.sprite.height * e.scale;
      let x = e.x;
      let y = e.y;
      if (e.owner) {
        const p = this.placement(e.owner);
        x = p.left + p.w / 2 - w / 2;
        // Pop up one pixel higher for a moment, then settle.
        y = p.top - h - (e.age < 0.15 ? 3 : 2) * e.scale;
      }
      ctx.drawImage(e.sprite, snap(x, e.scale), snap(y, e.scale), w, h);
    }
  }

  // ---------------------------------------------------------------- keeping apart

  /** 藍咩 and any 航星者, or two 航星者 on the same layer; near and far 航星者 may overlap. */
  private mustSeparate(a: Floater, b: Floater) {
    return a !== b && (a.kind === "blueme" || b.kind === "blueme" || a.layer === b.layer);
  }

  /**
   * Pairs that are meant to be close, so they don't steer away from each other: a visitor and
   * 藍咩, and members of the same convoy, whose spacing already keeps them apart.
   */
  private together(a: Floater, b: Floater) {
    const visiting = (f: Floater, o: Floater) => (f.mode === "visit" || f.mode === "greet") && f.other === o;
    if (visiting(a, b) || visiting(b, a)) return true;
    return a.mode === "convoy" && b.mode === "convoy" && a.other === b.other;
  }

  /** The painted part of the sprite this frame, horn and hop included, in device pixels. */
  private box(f: Floater, shift = 0) {
    const { w, h } = this.spriteSize(f);
    const s = f.scale;
    const b = f.kind === "blueme" ? BLUEME_SOLID : VOYAGER_SOLID;
    const pose = this.hopPose(f);
    const left = f.x + shift - w / 2;
    const top = f.y - h / 2 + Math.sin(f.bobClock) * f.bobAmp * s - pose.lift * s;
    const [x0, x1] = f.facing > 0 ? [b.x0, b.x1] : [b.cols - b.x1, b.cols - b.x0];
    let y0 = f.horn >= 0 ? Math.min(b.y0, HORN_BASE_ROW - HORN_STAGES[f.horn] + 1) : b.y0;
    // Stretched and squashed shapes keep their feet where they were and change at the top.
    y0 -= this.extraRows(pose.shape);
    return { left: left + x0 * s, right: left + x1 * s, top: top + y0 * s, bottom: top + b.y1 * s };
  }

  /** How many rows taller than usual a hop shape is. */
  private extraRows(shape: "short" | "tall" | "round") {
    if (shape === "round") return 0;
    return (shape === "tall" ? BLUEME_TALL.length : BLUEME_SHORT.length) - BLUEME_OPEN.length;
  }

  /**
   * The gaps between two characters' boxes along each axis, negative where they overlap, and
   * which side `b` is on. A 航星者 is measured the short way round the wrap.
   */
  private gaps(a: Floater, b: Floater) {
    const wrapper = a.kind === "voyager" ? a : b;
    const period = this.width + 1.5 * this.spriteSize(wrapper).w;
    const shift = wrapper.kind === "voyager" ? -Math.round((b.x - a.x) / period) * period : 0;
    const A = this.box(a);
    const B = this.box(b, shift);
    const cy = B.top + B.bottom - (A.top + A.bottom);
    // Level with each other: settle who goes over and who under by list order, so they part.
    const below = Math.abs(cy) < a.scale ? this.floaters.indexOf(a) < this.floaters.indexOf(b) : cy > 0;
    return {
      x: Math.max(B.left - A.right, A.left - B.right),
      y: Math.max(B.top - A.bottom, A.top - B.bottom),
      dirX: B.left + B.right >= A.left + A.right ? 1 : -1,
      dirY: below ? 1 : -1,
      width: A.right - A.left,
    };
  }

  /**
   * How readily `f` gives way when pushed. 藍咩 never does; a 航星者 on its way to visit her
   * mostly lets the others make room, so it doesn't get stuck behind them.
   */
  private yielding(f: Floater) {
    if (f.kind === "blueme") return 0;
    return f.mode === "visit" && f.phase === 0 ? 0.25 : 1;
  }

  /**
   * A nudge away from anyone `f` is about to bump into, to add to the velocity it wants. 藍咩
   * keeps her course, and so does a 航星者 on its way to visit her; the others make way.
   */
  private avoid(f: Floater) {
    let ax = 0;
    let ay = 0;
    if (this.yielding(f) < 1) return { ax, ay };
    for (const o of this.floaters) {
      if (!this.mustSeparate(f, o) || this.together(f, o)) continue;
      const g = this.gaps(f, o);
      const closing = Math.max(0, (f.vx - o.vx) * g.dirX);
      const zoneX = g.width * AVOID_ZONE + closing * AVOID_LOOKAHEAD;
      const zoneY = g.width * AVOID_ZONE;
      const near = Math.min(1 - g.x / zoneX, 1 - g.y / zoneY);
      const blueme = o.kind === "blueme";
      // Well clear of her again: the next time round it may pick a side afresh.
      if (blueme && near < -0.5) f.detour = null;
      if (near <= 0) continue;
      // Over the top if `o` is below, else underneath, unless that side has no room to pass.
      let over = g.dirY > 0;
      const ob = this.box(o);
      const fb = this.box(f);
      const tall = fb.bottom - fb.top;
      if (over && ob.top < tall) over = false;
      else if (!over && ob.bottom + tall > this.height) over = true;
      if (blueme) {
        // Round 藍咩 it sticks to the side it chose, and only moves up or down.
        f.detour ??= over ? "over" : "under";
        const push = f.speed * AVOID_PUSH_BLUEME * Math.min(1, near);
        ay += f.detour === "over" ? -push : push;
        continue;
      }
      const push = f.speed * AVOID_PUSH * Math.min(1, near);
      ay += over ? -push : push;
      ax -= g.dirX * push * 0.3;
    }
    return { ax, ay };
  }

  /**
   * Pushes apart whoever still overlaps, along the axis where they overlap least, and stops
   * them moving further into each other. A few passes, for one push shoving into another.
   */
  private resolveOverlaps(dt: number) {
    const fs = this.floaters;
    const cap = SEPARATE_MAX * this.dpr * dt;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (let i = 0; i < fs.length; i++) {
        for (let j = i + 1; j < fs.length; j++) {
          const a = fs[i];
          const b = fs[j];
          if (!this.mustSeparate(a, b)) continue;
          const g = this.gaps(a, b);
          // Keep one pixel of space between them.
          const space = Math.min(a.scale, b.scale);
          if (g.x >= space || g.y >= space) continue;
          const alongX = space - g.x <= space - g.y;
          const push = Math.min(space - (alongX ? g.x : g.y), cap);
          const dir = alongX ? g.dirX : g.dirY;
          const ya = this.yielding(a);
          const yb = this.yielding(b);
          const giveA = ya + yb > 0 ? ya / (ya + yb) : 0.5;
          if (alongX) {
            a.x -= dir * push * giveA;
            b.x += dir * push * (1 - giveA);
            if (a.vx * dir > 0) a.vx = 0;
            if (b.vx * dir < 0) b.vx = 0;
          } else {
            a.y -= dir * push * giveA;
            b.y += dir * push * (1 - giveA);
            if (a.vy * dir > 0) a.vy = 0;
            if (b.vy * dir < 0) b.vy = 0;
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  /**
   * Where the sprite's top-left lands this frame, snapped to its own pixel grid. A hop lifts it,
   * and a stretched or squashed hop shape starts higher or lower so the feet stay put.
   */
  private placement(f: Floater) {
    const { w, h } = this.spriteSize(f);
    const bob = Math.sin(f.bobClock) * f.bobAmp * f.scale;
    const pose = this.hopPose(f);
    const lift = (pose.lift + this.extraRows(pose.shape)) * f.scale;
    return { left: snap(f.x - w / 2, f.scale), top: snap(f.y - h / 2 + bob, f.scale) - lift, w, h };
  }

  /** Her usual face; stretched or squashed mid-hop, eyes open; otherwise open, blinking or asleep. */
  private bluemeSprite(f: Floater) {
    const { shape } = this.hopPose(f);
    if (shape === "tall") return this.sprites.tall;
    if (shape === "short") return this.sprites.short;
    return f.blinkLeft > 0 || f.mode === "doze" ? this.sprites.closed : this.sprites.open;
  }

  private drawFloater(f: Floater) {
    const ctx = this.ctx;
    const { left, top, w } = this.placement(f);
    let sprite: HTMLCanvasElement;
    if (f.kind === "blueme") sprite = this.bluemeSprite(f);
    else sprite = Math.floor(f.frameClock / FLOAT_FRAME_TIME) % 2 ? this.sprites.floatB : this.sprites.floatA;

    ctx.save();
    if (f.facing < 0) {
      ctx.translate(left + w, top);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(left, top);
    }
    ctx.drawImage(sprite, 0, 0, sprite.width * f.scale, sprite.height * f.scale);
    if (f.horn >= 0) {
      const horn = this.sprites.horns[f.horn];
      const row = HORN_BASE_ROW - horn.height + 1;
      ctx.drawImage(horn, HORN_COLUMN * f.scale, row * f.scale, horn.width * f.scale, horn.height * f.scale);
    }
    ctx.restore();
  }

  private sparkleAtHorn(f: Floater) {
    const { left, top, w } = this.placement(f);
    const height = HORN_STAGES[f.horn];
    // The tip sits in column 3 of the 5-wide horn grid.
    const col = HORN_COLUMN + 3;
    const x = f.facing > 0 ? left + col * f.scale : left + w - (col + 1) * f.scale;
    const y = top + (HORN_BASE_ROW - height + 1) * f.scale;
    for (let i = 0; i < 4; i++) {
      const a = rand([0, Math.PI * 2]);
      const v = rand([15, 40]) * this.dpr;
      this.sparkles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10 * this.dpr, life: rand([0.4, 0.8]), scale: f.scale });
    }
  }

  private drawSparkles() {
    const ctx = this.ctx;
    for (const s of this.sparkles) {
      // Blink on and off as it fades, the way pixel sparkles do.
      if (Math.floor(s.life * 12) % 2) continue;
      ctx.fillStyle = s.life > 0.3 ? "#fff3dc" : "#ef9fc4";
      ctx.fillRect(snap(s.x, s.scale), snap(s.y, s.scale), s.scale, s.scale);
    }
  }
}

/** Heads for a point `dx, dy` away, slowing down as it closes in. */
function seek(dx: number, dy: number, maxSpeed: number, ease: number): Steer {
  const d = Math.hypot(dx, dy);
  if (d < 1e-3) return { vx: 0, vy: 0, ease };
  const v = Math.min(maxSpeed, d * 1.5);
  return { vx: (dx / d) * v, vy: (dy / d) * v, ease };
}

function pickWeighted<T>(items: readonly [number, T][]): T | undefined {
  let r = Math.random() * items.reduce((sum, [w]) => sum + w, 0);
  for (const [w, item] of items) {
    r -= w;
    if (r < 0) return item;
  }
  return undefined;
}

/** The columns and rows a grid actually paints, end-exclusive, and its full width. */
function solidBounds(rows: readonly string[]) {
  let x0 = Infinity;
  let x1 = -1;
  let y0 = Infinity;
  let y1 = -1;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === ".") continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x + 1);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y + 1);
    }
  });
  return { x0, x1, y0, y1, cols: Math.max(...rows.map((r) => r.length)) };
}

/** Signed shortest turn from `b` to `a`, in radians. */
function angleDiff(a: number, b: number) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
