import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import HomePage from '../app/page'

describe('HomePage', () => {
  let container: any;

  beforeEach(() => {
    container = render(<HomePage />);
  });

  it('renders a heading', () => {
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
  })

  it('renders all courses with logos', () => {
    const courses = ['Google', 'AWS', 'K8s'];
    courses.forEach((course) => {
      expect(screen.getByText(course)).toBeInTheDocument();
      expect(screen.getByAltText(`${course} logo`)).toBeInTheDocument();
    });
  });

  it('renders login button', () => {
    expect(screen.getByRole('button', { name: /Sign In With GitHub/i })).toBeInTheDocument();
  });

  it('matches snapshot', () => {
    expect(container).toMatchSnapshot();
  });
})