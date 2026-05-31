export function WoreLogo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="114" fill="#0d0d0d"/>
      <text
        x="256" y="340"
        fontFamily="'Syne', 'Arial Black', sans-serif"
        fontSize="300"
        fontWeight="800"
        fill="#c8f55a"
        textAnchor="middle"
      >W</text>
      <line x1="80" y1="400" x2="175" y2="400" stroke="#333" strokeWidth="8"/>
      <line x1="337" y1="400" x2="432" y2="400" stroke="#333" strokeWidth="8"/>
      <text
        x="256" y="430"
        fontFamily="'Syne', 'Arial Black', sans-serif"
        fontSize="72"
        fontWeight="800"
        fill="#555"
        textAnchor="middle"
        letterSpacing="14"
      >WORE</text>
    </svg>
  );
}
