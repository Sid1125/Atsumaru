import Svg, { Circle, Path } from "react-native-svg";

/**
 * LINE and Google brand logos as inline SVGs. These are simplified mark-only
 * versions — no wordmarks — sized to sit inside a 20×20 frame next to the
 * button label. Colour is inherited from the parent via props.
 */

export function LineLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* LINE's speech-bubble mark */}
      <Path
        d="M12 2C6.48 2 2 5.82 2 10.5c0 3.67 3.12 6.77 7.35 7.85-.1.85-.37 2.65-.42 3.06-.08.63.23.62.48.45.19-.13 2.7-1.84 3.8-2.59.57.08 1.16.13 1.79.13 5.52 0 10-3.82 10-8.5S17.52 2 12 2Z"
        fill="#06C755"
      />
      <Path
        d="M8.5 9.5h-.5a.5.5 0 0 0 0 1H9v3.5a.5.5 0 0 0 1 0V10.5h.5a.5.5 0 0 0 0-1h-.5v-.5H9v.5h-.5ZM12 9.5h-.5a.5.5 0 0 0 0 1H12v3.5a.5.5 0 0 0 1 0V10.5h.5a.5.5 0 0 0 0-1h-.5v-.5H12v.5h-.5ZM15 9.5h-1v.5h1v1h-1v1h1v1.5a.5.5 0 0 0 1 0V10a.5.5 0 0 0-.5-.5H15v.5h.5v.5H15V9.5Z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

export function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Google "G" mark */}
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="#EA4335"
      />
    </Svg>
  );
}
