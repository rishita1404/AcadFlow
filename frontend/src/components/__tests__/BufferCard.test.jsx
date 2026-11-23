import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BufferCard from '../BufferCard.jsx';
import StatusBadge, { BANDS } from '../StatusBadge.jsx';

describe('Phase 1: BufferCard & Reframed Language', () => {
  it('renders headline and positive cushion with reserve copy', () => {
    render(<BufferCard stillNeed={15} buffer={5} />);
    expect(screen.getByText('Classes you must attend to stay eligible')).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
    expect(
      screen.getByText('Your cushion: 5 classes, kept in reserve for illness and emergencies')
    ).toBeDefined();
  });

  it('renders negative cushion as not recoverable without errors', () => {
    render(<BufferCard stillNeed={15} buffer={-5} />);
    expect(screen.getByText('Classes you must attend to stay eligible')).toBeDefined();
    expect(screen.getByText('Not recoverable by attendance alone')).toBeDefined();
  });

  it('renders insufficient data message when data is not ready', () => {
    render(<BufferCard stillNeed={null} buffer={null} insufficientData={true} />);
    expect(screen.getByText('Not enough data yet')).toBeDefined();
  });

  it('relabels Critical to Needs support and includes suggested next step', () => {
    render(<StatusBadge band="Critical" showNextStep />);
    expect(screen.getByText('Needs support')).toBeDefined();
    expect(screen.getByText(/Talk to your mentor/i)).toBeDefined();
    expect(BANDS.Critical.nextStep).toBe('Talk to your mentor');
  });
});
