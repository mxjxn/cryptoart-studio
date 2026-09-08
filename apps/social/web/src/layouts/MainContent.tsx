import cn from 'classnames';
import { FC, memo, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { FullScreenErrorBoundary } from '~/components/errors/FullScreenErrorBoundary';
import { FullScreenLoadingIndicator } from '~/components/loaders/FullScreenLoadingIndicator';
import { usePageLayoutSize } from '~/hooks/layout/usePageLayout';
import { MobileHeader } from '~/layouts/MobileHeader';

const MainContent: FC = memo(() => {
  const size = usePageLayoutSize();
  const location = useLocation();

  return (
    <main
      className={cn(
        'h-full w-full shrink-0 justify-center',
        'sm:mr-4 sm:w-[540px] lg:w-[620px]',
        size === 'full' && 'lg:!w-[1013px]',
        location.pathname === '/' &&
          'sm:!mr-0 sm:!w-full lg:!w-full xl:!w-[1216px]',
      )}
    >
      {location.pathname !== '/' && <MobileHeader />}
      <Suspense fallback={<FullScreenLoadingIndicator />}>
        <FullScreenErrorBoundary>
          <Outlet />
        </FullScreenErrorBoundary>
      </Suspense>
    </main>
  );
});

MainContent.displayName = 'MainContent';

export { MainContent };
