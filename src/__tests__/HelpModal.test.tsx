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
    
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('Send message')).toBeInTheDocument();
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('New line')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('displays all keyboard shortcuts', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} />);
    
    // Check for unique shortcuts (avoiding "/" which appears twice)
    const shortcuts = [
      { label: 'Send message', key: 'Enter' },
      { label: 'New line', key: 'Shift+Enter' },
      { label: 'Slash commands' },
      { label: 'Close modal / deselect', key: 'Esc' },
      { label: 'Navigate messages', key: '↑ / ↓ or j/k' },
      { label: 'Copy selected msg', key: 'c' }
    ];

    shortcuts.forEach(({ label, key }) => {
      expect(screen.getByText(label)).toBeInTheDocument();
      if (key) {
        expect(screen.getByText(key)).toBeInTheDocument();
      }
    });
    
    // "/" appears in both shortcut and tip, so use getAllByText
    expect(screen.getAllByText('/')).toHaveLength(2);
  });
});
