type BrandLogoProps = {
  size?: 'sm' | 'lg';
  className?: string;
};

const SIZE = {
  sm: 'w-12 h-12 p-1',
  lg: 'w-24 h-24 p-1.5',
} as const;

export default function BrandLogo({ size = 'sm', className = '' }: BrandLogoProps) {
  return (
    <div className={`${SIZE[size]} border-2 border-ink bg-white brutal-shadow ${className}`}>
      <img
        src="/assets/icu-logo.png"
        alt="Information and Communications University"
        className="w-full h-full object-contain"
      />
    </div>
  );
}
