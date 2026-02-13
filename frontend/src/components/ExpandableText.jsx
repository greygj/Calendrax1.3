import React, { useState, useRef, useEffect } from 'react';

const ExpandableText = ({ text, maxLines = 2, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpansion, setNeedsExpansion] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseInt(window.getComputedStyle(textRef.current).lineHeight) || 20;
      const maxHeight = lineHeight * maxLines;
      setNeedsExpansion(textRef.current.scrollHeight > maxHeight + 5);
    }
  }, [text, maxLines]);

  if (!text) return null;

  return (
    <div className={className}>
      <p
        ref={textRef}
        className={`text-gray-500 text-sm mt-1 transition-all duration-200 ${
          !isExpanded && needsExpansion ? 'line-clamp-2' : ''
        }`}
        style={!isExpanded && needsExpansion ? { 
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        } : {}}
      >
        {text}
      </p>
      {needsExpansion && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="text-brand-400 text-sm mt-1 hover:text-brand-300 transition-colors focus:outline-none"
        >
          {isExpanded ? 'See less' : 'See more...'}
        </button>
      )}
    </div>
  );
};

export default ExpandableText;
