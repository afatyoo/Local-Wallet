import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  type AnchorHTMLAttributes,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

interface LocationState {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
}

interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

type NavigateFunction = (to: string, options?: NavigateOptions) => void;

interface RouterContextValue {
  location: LocationState;
  navigate: NavigateFunction;
}

const RouterContext = createContext<RouterContextValue | null>(null);

const currentLocation = (): LocationState => ({
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
  state: window.history.state?.localWalletState ?? null,
});

const safeUrl = (to: string) => {
  if (!to.startsWith('/') || to.startsWith('//') || to.includes('\\')) {
    throw new Error('Navigation target must be an internal application path');
  }

  const url = new URL(to, window.location.origin);
  if (url.origin !== window.location.origin) {
    throw new Error('Cross-origin navigation is not allowed');
  }

  return `${url.pathname}${url.search}${url.hash}`;
};

export function BrowserRouter({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(currentLocation);

  useEffect(() => {
    const handlePopState = () => setLocation(currentLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useMemo<NavigateFunction>(() => (to, options = {}) => {
    const target = safeUrl(to);
    const historyState = { localWalletState: options.state ?? null };

    if (options.replace) {
      window.history.replaceState(historyState, '', target);
    } else {
      window.history.pushState(historyState, '', target);
    }
    setLocation(currentLocation());
  }, []);

  return (
    <RouterContext.Provider value={{ location, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

const useRouter = () => {
  const router = useContext(RouterContext);
  if (!router) throw new Error('Router components must be used inside BrowserRouter');
  return router;
};

export const useLocation = () => useRouter().location;
export const useNavigate = () => useRouter().navigate;

export function Navigate({ to, replace, state }: { to: string; replace?: boolean; state?: unknown }) {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(to, { replace, state });
  }, [navigate, replace, state, to]);

  return null;
}

interface RouteProps {
  path: string;
  element: ReactElement;
}

export function Route(_props: RouteProps) {
  return null;
}

export function Routes({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const routes = Children.toArray(children).filter(
    (child): child is ReactElement<RouteProps> => isValidElement<RouteProps>(child),
  );
  const match = routes.find(route => route.props.path === pathname)
    ?? routes.find(route => route.props.path === '*');

  return match?.props.element ?? null;
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  replace?: boolean;
  state?: unknown;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, state, onClick, target, ...props },
  ref,
) {
  const navigate = useNavigate();
  const href = safeUrl(to);

  return (
    <a
      ref={ref}
      {...props}
      href={href}
      target={target}
      onClick={event => {
        onClick?.(event);
        if (
          event.defaultPrevented
          || event.button !== 0
          || event.metaKey
          || event.ctrlKey
          || event.shiftKey
          || event.altKey
          || target === '_blank'
        ) return;

        event.preventDefault();
        navigate(href, { replace, state });
      }}
    />
  );
});

interface NavLinkState {
  isActive: boolean;
  isPending: boolean;
}

interface NavLinkProps extends Omit<LinkProps, 'className'> {
  className?: string | ((state: NavLinkState) => string);
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { className, to, ...props },
  ref,
) {
  const { pathname } = useLocation();
  const state = { isActive: pathname === safeUrl(to).split(/[?#]/)[0], isPending: false };

  return (
    <Link
      ref={ref}
      {...props}
      to={to}
      className={typeof className === 'function' ? className(state) : className}
    />
  );
});

export type { NavLinkProps };
