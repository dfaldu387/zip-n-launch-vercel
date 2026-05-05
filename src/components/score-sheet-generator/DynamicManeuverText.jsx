import React, { useRef, useEffect, useState } from 'react';

const abbreviateText = (text) => {
    if (text.length < 30) return text;
    
    let abbreviated = text;
    
    const abbreviations = {
        'serpentine over poles': 'serpentine',
        'over a pole': 'over pole',
        'through a gate': 'gate',
        'walk to': 'walk',
        'jog to': 'jog',
        'lope to': 'lope',
        'trot to': 'trot',
        'stop and back': 'stop/back',
        'a 360 degree turn': '360 turn',
        'a 180 degree turn': '180 turn',
        'a 90 degree turn': '90 turn',
        'left lead': 'L lead',
        'right lead': 'R lead',
        'degree': '°',
        'and': '&',
        'with': 'w/',
        'without': 'w/o',
        'between': 'btwn',
        'American Quarter Horse Association': 'AQHA',
        'American Paint Horse Association': 'APHA',
    };

    for (const [key, value] of Object.entries(abbreviations)) {
        abbreviated = abbreviated.replace(new RegExp(key, 'gi'), value);
    }
    
    return abbreviated;
};

const DynamicManeuverText = ({ text }) => {
    const containerRef = useRef(null);
    const textRef = useRef(null);
    const [fontSize, setFontSize] = useState(14);

    useEffect(() => {
        const container = containerRef.current;
        const textEl = textRef.current;

        if (!container || !textEl) return;

        let currentFontSize = 14;
        textEl.style.fontSize = `${currentFontSize}px`;

        const checkOverflow = () => textEl.scrollHeight > container.clientHeight || textEl.scrollWidth > container.clientWidth;

        while (checkOverflow() && currentFontSize > 7) {
            currentFontSize -= 0.5;
            textEl.style.fontSize = `${currentFontSize}px`;
        }

        setFontSize(currentFontSize);
    }, [text]);

    const displayText = abbreviateText(text);

    return (
        <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden p-1">
            <span
                ref={textRef}
                className="text-center"
                style={{ fontSize: `${fontSize}px`, lineHeight: '1.2' }}
            >
                {displayText}
            </span>
        </div>
    );
};

export default DynamicManeuverText;