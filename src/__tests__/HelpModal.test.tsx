import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelpModal } from '../components/HelpModal';

describe('HelpModal Component', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<HelpModal isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal content when open', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} />);
    
    expect(screen.getByText('Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('New Line')).toBeInTheDocument();
    expect(screen.getByText('Commands')).toBeInTheDocument();
  });

  it('displays all keyboard shortcuts', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} />);
    
    const shortcuts = [
      { label: 'Send', key: 'Enter' },
      { label: 'New Line', key: 'Shift+Ent' },
      { label: 'Commands', key: '/' },
      { label: 'Close', key: 'Esc' }
    ];

    shortcuts.forEach(({ label, key }) => {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(key)).toBeInTheDocument();
    });
  });
});
