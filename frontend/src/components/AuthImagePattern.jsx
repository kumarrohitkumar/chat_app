const AuthImagePattern = ({ title, subtitle }) => (
  <div className="hidden lg:flex items-center justify-center bg-base-200 p-12">
    <div className="max-w-md text-center animate-fade-up">
      <div className="grid grid-cols-3 gap-3 mb-8">
        {Array.from({ length: 9 }).map((_, index) => (
          <div
            key={index}
            // A slow, offset breathe across the grid rather than nine tiles
            // pulsing in lockstep.
            style={{ animationDelay: `${index * 120}ms`, animationDuration: "3.2s" }}
            className="aspect-square rounded-2xl bg-primary/10 animate-pulse"
          />
        ))}
      </div>
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <p className="text-base-content/60">{subtitle}</p>
    </div>
  </div>
);

export default AuthImagePattern;
