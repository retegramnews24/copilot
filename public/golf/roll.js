// Quaternions use world coordinates (x, up, z). Each segment rolls about
// a horizontal axis perpendicular to the ball's motion.
export const upright=[0,0,0,1];

export function rollBy(rotation,dx,dz,radius){
  const distance=Math.hypot(dx,dz);
  if(!distance)return rotation;
  const half=distance/(2*radius), s=Math.sin(half)/distance;
  const ax=dz*s,az=-dx*s,aw=Math.cos(half);
  const [x,y,z,w]=rotation;
  return [aw*x+ax*w-az*y,aw*y+az*x-ax*z,aw*z+az*w+ax*y,aw*w-ax*x-az*z];
}

export function rotateVector([x,y,z,w],[vx,vy,vz]){
  const tx=2*(y*vz-z*vy),ty=2*(z*vx-x*vz),tz=2*(x*vy-y*vx);
  return [vx+w*tx+y*tz-z*ty,vy+w*ty+z*tx-x*tz,vz+w*tz+x*ty-y*tx];
}
