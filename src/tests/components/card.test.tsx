import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

describe('Card Component', () => {
  it('should render basic card', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('should render card with header', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
        </CardHeader>
      </Card>
    );

    expect(screen.getByText('Card Title')).toBeInTheDocument();
  });

  it('should render card with description', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description text</CardDescription>
        </CardHeader>
      </Card>
    );

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Description text')).toBeInTheDocument();
  });

  it('should render card with content', () => {
    render(
      <Card>
        <CardContent>
          <p>Main content here</p>
        </CardContent>
      </Card>
    );

    expect(screen.getByText('Main content here')).toBeInTheDocument();
  });

  it('should render card with footer', () => {
    render(
      <Card>
        <CardFooter>
          <p>Footer content</p>
        </CardFooter>
      </Card>
    );

    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('should render complete card structure', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Complete Card</CardTitle>
          <CardDescription>This is a description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Main content</p>
        </CardContent>
        <CardFooter>
          <p>Footer</p>
        </CardFooter>
      </Card>
    );

    expect(screen.getByText('Complete Card')).toBeInTheDocument();
    expect(screen.getByText('This is a description')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('should apply custom className to Card', () => {
    render(<Card className="custom-card">Content</Card>);
    const card = screen.getByText('Content').closest('div');

    expect(card).toHaveClass('custom-card');
  });

  it('should apply custom className to CardHeader', () => {
    const { container } = render(
      <CardHeader className="custom-header">
        <CardTitle>Title</CardTitle>
      </CardHeader>
    );

    const header = container.querySelector('.custom-header');
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass('custom-header');
  });
});
