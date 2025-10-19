import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>);
    const button = screen.getByText('Disabled Button');

    expect(button).toBeDisabled();
  });

  it('should apply variant classes', () => {
    const { rerender } = render(<Button variant="default">Button</Button>);
    let button = screen.getByText('Button');
    expect(button).toBeInTheDocument();

    rerender(<Button variant="destructive">Button</Button>);
    button = screen.getByText('Button');
    expect(button).toBeInTheDocument();

    rerender(<Button variant="outline">Button</Button>);
    button = screen.getByText('Button');
    expect(button).toBeInTheDocument();
  });

  it('should apply size classes', () => {
    const { rerender } = render(<Button size="default">Button</Button>);
    let button = screen.getByText('Button');
    expect(button).toBeInTheDocument();

    rerender(<Button size="sm">Button</Button>);
    button = screen.getByText('Button');
    expect(button).toBeInTheDocument();

    rerender(<Button size="lg">Button</Button>);
    button = screen.getByText('Button');
    expect(button).toBeInTheDocument();
  });

  it('should render as child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );

    const link = screen.getByText('Link Button');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/test');
  });

  it('should support custom className', () => {
    render(<Button className="custom-class">Button</Button>);
    const button = screen.getByText('Button');

    expect(button).toHaveClass('custom-class');
  });

  it('should not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    fireEvent.click(screen.getByText('Disabled'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should render with children', () => {
    render(
      <Button>
        <span>Icon</span>
        <span>Text</span>
      </Button>
    );

    expect(screen.getByText('Icon')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
  });
});
