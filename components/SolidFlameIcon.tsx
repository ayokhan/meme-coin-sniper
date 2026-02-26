"use client";

/**
 * Solid flame icon – single filled shape, no empty space or gaps inside.
 * Uses one path with fill (orange gradient via CSS) so the flame reads as fully solid.
 */
export default function SolidFlameIcon({
  className = "",
  ...props
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      {...props}
    >
      {/* Single continuous path: solid flame with no holes or gaps */}
      <path d="M12 23c3.5-1.5 6-4.5 6-9 0-2-.8-3.8-2.2-5.2C14.2 7.2 12 4 12 1c0 0-2.2 6.2-3.8 7.8C5.8 10.2 5 12 5 14c0 4.5 2.5 7.5 6 9z" />
    </svg>
  );
}
