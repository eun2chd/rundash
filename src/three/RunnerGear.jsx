export function RunningShoe({ style, color, material: M }) {
  const trail = style === 'trail'
  const race = style === 'race'
  return <group position={[0, -0.47, 0.08]}>
    <mesh scale={[1, .62, 1.65]}><sphereGeometry args={[.125, 18, 12]} />{M(color)}</mesh>
    <mesh position={[0, -.055, .018]} scale={[1.04, .3, 1.7]}><sphereGeometry args={[.13, 18, 12]} />{M(race ? '#e8c547' : '#f4f1e8')}</mesh>
    <mesh position={[0, -.083, .018]} scale={[1.04, .14, 1.7]}><sphereGeometry args={[.13, 16, 10]} />{M('#303a35')}</mesh>
    {[0, .045, .09].map((z) => <mesh key={z} position={[0, .064, z]} rotation-z={.12}><boxGeometry args={[.13, .012, .014]} />{M('#fff8e6')}</mesh>)}
    <mesh position={[.116, 0, .045]} rotation-x={-.35}><boxGeometry args={[.012, .032, .12]} />{M('#e07b39')}</mesh>
    <mesh position={[0, .055, -.12]}><boxGeometry args={[.06, .07, .025]} />{M('#e07b39')}</mesh>
    {trail && [-.07, .07].flatMap((x) => [-.1, 0, .1].map((z) => <mesh key={`${x}-${z}`} position={[x, -.097, z]}><boxGeometry args={[.045, .03, .05]} />{M('#212121')}</mesh>))}
  </group>
}

export function Headwear({ outfit, material: M }) {
  const { hat, hatColor } = outfit
  if (hat === 'none') return null
  if (hat === 'beanie') return <group>
    <mesh position-y={.09}><sphereGeometry args={[.455, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />{M(hatColor)}</mesh>
    <mesh position-y={.115} rotation-x={Math.PI / 2}><torusGeometry args={[.422, .045, 8, 36]} />{M(hatColor)}</mesh>
    <mesh position={[0, .17, .434]}><boxGeometry args={[.12, .075, .015]} />{M('#f4f1e8')}</mesh>
  </group>
  return <group>
    {hat === 'cap' && <mesh position-y={.065}><sphereGeometry args={[.45, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />{M(hatColor)}</mesh>}
    <mesh position-y={.17} rotation-x={Math.PI / 2 - .12}><torusGeometry args={[.405, hat === 'band' ? .048 : .035, 10, 36]} />{M(hatColor)}</mesh>
    {(hat === 'cap' || hat === 'visor') && <mesh position={[0, .155, .4]} rotation-x={.08} scale={[1, .11, 1]}><sphereGeometry args={[.32, 24, 12]} />{M(hatColor)}</mesh>}
    <mesh position={[0, .2, .411]}><boxGeometry args={[.1, .027, .018]} />{M('#f4f1e8')}</mesh>
  </group>
}

export function RunningVest({ outfit, material: M }) {
  if (outfit.vest === 'none') return null
  const trail = outfit.vest === 'trail'
  return <group>
    <mesh position={[0, .91, -.21]}><boxGeometry args={[.4, .38, trail ? .18 : .09]} />{M(outfit.vestColor)}</mesh>
    {[-1, 1].map((side) => <group key={side}>
      <mesh position={[side * .17, .94, .225]} rotation-z={side * -.08}><capsuleGeometry args={[.07, .29, 4, 10]} />{M(outfit.vestColor)}</mesh>
      <mesh position={[side * .17, .83, .285]}><boxGeometry args={[.11, .13, .065]} />{M(outfit.vestColor)}</mesh>
      {trail && <group position={[side * .17, .91, .31]}>
        <mesh><capsuleGeometry args={[.035, .09, 4, 10]} />{M('#a6d9e5')}</mesh>
        <mesh position-y={.083}><cylinderGeometry args={[.022, .022, .035, 10]} />{M('#f4f1e8')}</mesh>
      </group>}
      <mesh position={[side * .19, 1.04, .282]}><boxGeometry args={[.065, .025, .015]} />{M('#f4f1e8')}</mesh>
    </group>)}
    {[.86, 1.02].map((y) => <mesh key={y} position={[0, y, .285]}><boxGeometry args={[.25, .02, .025]} />{M('#303a35')}</mesh>)}
    <mesh position={[0, 1.02, .303]}><boxGeometry args={[.045, .035, .025]} />{M('#e07b39')}</mesh>
  </group>
}
