import { useEffect, useState } from "react";

const RobotAnimation = () => {
  const [noteCount, setNoteCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setNoteCount((prev) => (prev + 1) % 4);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        {/* Computer/Monitor */}
        <div className="w-48 h-36 bg-muted rounded-lg border-4 border-border relative overflow-hidden">
          {/* Screen content - scrolling lines */}
          <div className="absolute inset-2 bg-background rounded overflow-hidden">
            <div className="animate-pulse space-y-2 p-2">
              <div className="h-2 bg-primary/30 rounded w-full"></div>
              <div className="h-2 bg-primary/20 rounded w-4/5"></div>
              <div className="h-2 bg-primary/30 rounded w-full"></div>
              <div className="h-2 bg-primary/20 rounded w-3/5"></div>
              <div className="h-2 bg-primary/30 rounded w-full"></div>
              <div className="h-2 bg-primary/20 rounded w-4/5"></div>
            </div>
          </div>
        </div>
        
        {/* Monitor Stand */}
        <div className="w-12 h-4 bg-border mx-auto"></div>
        <div className="w-20 h-2 bg-border mx-auto rounded-b"></div>
        
        {/* Robot */}
        <div className="absolute -right-20 top-4 animate-bounce" style={{ animationDuration: '2s' }}>
          {/* Robot Head */}
          <div className="w-16 h-14 bg-primary rounded-lg relative">
            {/* Eyes */}
            <div className="absolute top-3 left-2 w-4 h-4 bg-background rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-foreground rounded-full animate-pulse"></div>
            </div>
            <div className="absolute top-3 right-2 w-4 h-4 bg-background rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-foreground rounded-full animate-pulse"></div>
            </div>
            {/* Antenna */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-1 h-4 bg-primary"></div>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-3 h-3 bg-accent rounded-full animate-ping"></div>
            {/* Mouth */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-1.5 bg-background rounded"></div>
          </div>
          
          {/* Robot Body */}
          <div className="w-14 h-10 bg-primary/80 mx-auto rounded-b-lg relative">
            {/* Arms */}
            <div className="absolute -left-3 top-1 w-3 h-6 bg-primary rounded-full origin-top animate-[wave_1s_ease-in-out_infinite]"></div>
            <div className="absolute -right-3 top-1 w-3 h-6 bg-primary rounded-full"></div>
          </div>
        </div>
        
        {/* Notepad */}
        <div className="absolute -left-24 top-8">
          <div className="w-20 h-28 bg-card border-2 border-border rounded shadow-lg p-2">
            <div className="space-y-1">
              {[...Array(noteCount + 1)].map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 bg-primary/50 rounded animate-fade-in"
                  style={{ width: `${60 + Math.random() * 40}%` }}
                ></div>
              ))}
            </div>
            {/* Pencil */}
            <div className="absolute -right-2 top-4 w-1 h-8 bg-yellow-500 rounded transform rotate-45">
              <div className="absolute bottom-0 w-0 h-0 border-l-[2px] border-r-[2px] border-t-[4px] border-l-transparent border-r-transparent border-t-gray-800"></div>
            </div>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-muted-foreground text-lg animate-pulse">
        Analisando seu site...
      </p>
      <p className="text-sm text-muted-foreground/70 mt-2">
        O robô está lendo e tomando notas 📝
      </p>
    </div>
  );
};

export default RobotAnimation;
