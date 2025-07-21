import Header from './components/Header';
import LoginButton from './components/LoginButton';

const logos: Record<string, string> = {
  Google: 'https://www.svgrepo.com/show/475656/google-color.svg',
  AWS: 'https://www.svgrepo.com/show/448266/aws.svg',
  K8s: 'https://raw.githubusercontent.com/kubernetes/kubernetes/master/logo/logo.png',
};

export default function HomePage() {
  const courses = ['Google', 'AWS', 'K8s'];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Header />
      <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {courses.map((course) => (
          <li
            key={course}
            className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md"
          >
            <img src={logos[course]} alt={`${course} logo`} className="h-10 w-10" />
            <span className="text-lg font-medium text-gray-800 dark:text-white">
              {course}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-12">
        <LoginButton />
      </div>
    </div>
  );
}
