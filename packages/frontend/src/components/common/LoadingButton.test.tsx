import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoadingButton } from './LoadingButton';

describe('LoadingButton', () => {
  it('renders children text', () => {
    render(<LoadingButton>Submit</LoadingButton>);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('defaults to type="button"', () => {
    render(<LoadingButton>Click</LoadingButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('supports type="submit"', () => {
    render(<LoadingButton type="submit">Go</LoadingButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<LoadingButton onClick={handleClick}>Click me</LoadingButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is true', () => {
    const handleClick = vi.fn();
    render(<LoadingButton onClick={handleClick} disabled>Click</LoadingButton>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('is disabled and shows spinner when loading', () => {
    const handleClick = vi.fn();
    render(<LoadingButton onClick={handleClick} loading>Save</LoadingButton>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('hides content text when loading', () => {
    render(<LoadingButton loading>Save</LoadingButton>);
    const contentSpan = screen.getByText('Save');
    expect(contentSpan).toHaveClass('opacity-0');
  });

  it('shows content text when not loading', () => {
    render(<LoadingButton>Save</LoadingButton>);
    const contentSpan = screen.getByText('Save');
    expect(contentSpan).toHaveClass('opacity-100');
  });

  it('applies primary variant classes by default', () => {
    render(<LoadingButton>Primary</LoadingButton>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-primary');
    expect(btn.className).toContain('text-white');
  });

  it('applies secondary variant classes', () => {
    render(<LoadingButton variant="secondary">Secondary</LoadingButton>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border');
    expect(btn.className).toContain('text-primary');
    expect(btn.className).toContain('bg-white');
  });

  it('applies danger variant classes', () => {
    render(<LoadingButton variant="danger">Delete</LoadingButton>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-accent');
    expect(btn.className).toContain('text-white');
  });

  it('sets aria-busy=false when not loading', () => {
    render(<LoadingButton>Go</LoadingButton>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'false');
  });
});
