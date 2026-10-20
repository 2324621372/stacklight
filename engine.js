export const CONFIG = Object.freeze({ colors: ['cyan', 'gold', 'rose', 'white'], width: 420, blockWidth: 126, step: 14, limit: 30, baseScore: 10, heightBonus: 2, firstStorm: 45, minStorm: 20, stormShrink: 5, darkDuration: 2, windDuration: 6, warning: 3, recover: 8, penalty: 15 });
export function seeded(seed) { let a = seed >>> 0; return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ a >>> 15, 1 | a); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function dateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function dailyRule(date = dateKey()) { const seed = Number(date.replaceAll('-', '')); return { date, seed, index: seed % 3, target: [25, 3, 1500][seed % 3] }; }
export class Game {
  constructor({ mode = 'classic', item = 'steady', date, random = Math.random } = {}) {
    this.mode = mode; this.rule = dailyRule(date); this.random = mode === 'daily' ? seeded(this.rule.seed) : random;
    this.colors = mode === 'daily' && this.rule.index === 0 ? CONFIG.colors.slice(0, 2) : CONFIG.colors;
    this.stormFactor = mode === 'daily' && this.rule.index === 1 ? .7 : 1;
    this.item = mode === 'daily' && this.rule.index === 2 ? null : item;
    this.blocks = []; this.score = 0; this.imbalance = 0; this.maxImbalance = 0; this.maxHeight = 0; this.combo = 0; this.maxCombo = 0; this.storms = 0; this.stormLandings = 0; this.elapsed = 0;
    this.nextStorm = CONFIG.firstStorm * this.stormFactor; this.storm = null; this.stormRemaining = 0; this.stormCount = 0; this.shield = false; this.slowNext = false; this.over = false; this.reason = null;
    this.nextColor = this.color(); this.spawn();
  }
  color() { return this.colors[Math.floor(this.random() * this.colors.length)]; }
  spawn() { this.current = { x: 210, color: this.nextColor }; this.nextColor = this.color(); this.turnTime = 0; }
  move(direction) { if (!this.over) this.setX(this.current.x + direction * CONFIG.step); }
  setX(x) { this.current.x = Math.max(70, Math.min(350, Math.round(x / CONFIG.step) * CONFIG.step)); }
  tick(dt) {
    if (this.over) return [];
    this.elapsed += dt; this.turnTime += dt; const events = [];
    if (this.storm) { this.stormRemaining -= dt; if (this.stormRemaining <= 0) { this.storm = null; this.storms++; events.push('storm-end'); } }
    if (!this.storm && this.elapsed >= this.nextStorm) {
      this.stormCount++; const type = this.stormCount % 2 ? 'wind' : 'dark';
      this.nextStorm = this.elapsed + Math.max(CONFIG.minStorm, CONFIG.firstStorm - this.stormCount * CONFIG.stormShrink) * this.stormFactor;
      if (type === 'dark' && this.shield) { this.shield = false; this.storms++; events.push('shield'); }
      else { this.storm = type; this.stormRemaining = type === 'dark' ? CONFIG.darkDuration : CONFIG.windDuration; events.push(type); }
    }
    return events;
  }
  useItem() {
    if (!this.item || this.over) return false;
    if (this.item === 'steady') this.imbalance = 0;
    if (this.item === 'clear_dark') this.shield = true;
    if (this.item === 'slow_fall') this.slowNext = true;
    this.item = null; return true;
  }
  drop() {
    if (this.over) return null;
    let x = this.current.x;
    if (this.storm === 'wind') x = Math.max(70, Math.min(350, x + (this.random() < .5 ? -1 : 1) * CONFIG.step));
    const top = this.blocks.at(-1); const offset = Math.abs(x - (top?.x ?? 210)); const good = offset <= CONFIG.step;
    this.imbalance = Math.max(0, this.imbalance + (good ? -CONFIG.recover : CONFIG.penalty * Math.max(1, Math.floor(offset / 42))));
    this.maxImbalance = Math.max(this.maxImbalance, this.imbalance);
    this.blocks.push({ x, color: this.current.color }); this.maxHeight = Math.max(this.maxHeight, this.blocks.length);
    this.score += CONFIG.baseScore + this.blocks.length * CONFIG.heightBonus;
    let chain = 0, removed = 0;
    // Removing a matching pair exposes an older pair, which can cascade.
    while (this.blocks.length >= 2) {
      let found = -1;
      for (let i = this.blocks.length - 1; i > 0; i--) {
        if (this.blocks[i].color === this.blocks[i - 1].color && Math.abs(this.blocks[i].x - this.blocks[i - 1].x) < CONFIG.blockWidth) { found = i; break; }
      }
      if (found < 0) break;
      this.blocks.splice(found - 1, 2); chain++; removed += 2;
    }
    if (chain) { this.combo++; const multiplier = chain >= 3 ? 2.5 : chain === 2 ? 1.5 : 1; this.score += Math.round(40 * removed * multiplier); this.nextStorm += 2 * chain; this.imbalance = Math.max(0, this.imbalance - 4 * removed); }
    else this.combo = 0;
    this.maxCombo = Math.max(this.maxCombo, this.combo, chain);
    if (this.storm) this.stormLandings++;
    if (this.imbalance >= 100) { this.over = true; this.reason = 'imbalance'; }
    else if (this.blocks.length >= CONFIG.limit) { this.over = true; this.reason = 'ceiling'; }
    const outcome = { x, good, chain, removed, combo: this.combo, color: this.current.color }; this.spawn(); return outcome;
  }
  get dailyProgress() { return [this.maxHeight, this.storms, this.score][this.rule.index]; }
  get dailyDone() { return this.mode === 'daily' && this.dailyProgress >= this.rule.target; }
}