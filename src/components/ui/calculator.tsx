'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CalculatorProps {
  onResult: (result: number) => void;
  onClose: () => void;
  initialValue?: number;
}

export function Calculator({ onResult, onClose, initialValue = 0 }: CalculatorProps) {
  const [display, setDisplay] = React.useState(String(initialValue));
  const [operator, setOperator] = React.useState<string | null>(null);
  const [prevValue, setPrevValue] = React.useState<number | null>(null);
  const [isNewEntry, setIsNewEntry] = React.useState(true);

  const handleNumberClick = (num: string) => {
    if (isNewEntry) {
      setDisplay(num);
      setIsNewEntry(false);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperatorClick = (op: string) => {
    if (operator && prevValue !== null && !isNewEntry) {
      calculate();
      setOperator(op);
    } else {
        setPrevValue(parseFloat(display));
        setOperator(op);
        setIsNewEntry(true);
    }
  };

  const calculate = () => {
    if (!operator || prevValue === null) return;
    const currentValue = parseFloat(display);
    let result = 0;

    switch (operator) {
      case '+': result = prevValue + currentValue; break;
      case '-': result = prevValue - currentValue; break;
      case '*': result = prevValue * currentValue; break;
      case '/': result = prevValue / currentValue; break;
      default: return;
    }
    setDisplay(String(result));
    setPrevValue(result);
    setIsNewEntry(true);
  };
  
  const handleEquals = () => {
      calculate();
      setOperator(null);
  }

  const handleClear = () => {
    setDisplay('0');
    setOperator(null);
    setPrevValue(null);
    setIsNewEntry(true);
  };
  
  const handleDecimal = () => {
    if (!display.includes('.')) {
      setDisplay(display + '.');
      setIsNewEntry(false);
    }
  };

  const handleUseResult = () => {
    onResult(parseFloat(display));
    onClose();
  };
  
  const buttons = [
    '7', '8', '9', '/',
    '4', '5', '6', '*',
    '1', '2', '3', '-',
    'C', '0', '.', '+',
  ];

  const handleButtonClick = (btn: string) => {
    if (!isNaN(parseInt(btn))) {
      handleNumberClick(btn);
    } else if (['+', '-', '*', '/'].includes(btn)) {
      handleOperatorClick(btn);
    } else if (btn === '.') {
      handleDecimal();
    } else if (btn === 'C') {
      handleClear();
    }
  };


  return (
    <Card className="w-64">
      <CardContent className="p-2 space-y-2">
        <div className="bg-muted text-right text-2xl font-mono p-2 rounded-md truncate">
          {display}
        </div>
        <div className="grid grid-cols-4 gap-2">
            {buttons.map(btn => (
                <Button 
                    key={btn} 
                    variant={!isNaN(parseInt(btn)) || btn === '.' ? 'outline' : 'secondary'}
                    onClick={() => handleButtonClick(btn)}
                    className="text-lg font-bold"
                >
                    {btn}
                </Button>
            ))}
        </div>
        <Button onClick={handleEquals} className="w-full" variant="secondary">=</Button>
        <Button onClick={handleUseResult} className="w-full">Usar Resultado</Button>
      </CardContent>
    </Card>
  );
}
