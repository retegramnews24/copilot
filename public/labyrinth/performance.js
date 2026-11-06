// Hysteresis avoids resolution oscillation. Tab-resume spikes do not reduce quality.
export class FrameBudget{
 constructor(){this.scale=1;this.slow=0;this.fast=0}
 sample(seconds){if(!Number.isFinite(seconds)||seconds<=0||seconds>.15)return this.scale;if(seconds>.026){this.slow++;this.fast=0}else{this.slow=Math.max(0,this.slow-2);if(seconds<.019)this.fast++;else this.fast=0}if(this.slow>=45){this.scale=Math.max(.65,Math.round((this.scale-.1)*100)/100);this.slow=0;this.fast=0}if(this.fast>=300){this.scale=Math.min(1,Math.round((this.scale+.05)*100)/100);this.fast=0}return this.scale}
 reset(){this.scale=1;this.slow=0;this.fast=0}
}
