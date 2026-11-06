// Stand-in for react-native-sortables in Jest (registered in jest.setup.ts). Gestures and
// Reanimated layout do not run in tests, so Grid renders its items in a plain View with
// testID "sortable-grid" (its items are in the `items` prop). A test simulates a finished drag
// with
//   const grid = screen.getByTestId('sortable-grid');
//   fireEvent(grid, 'dragEnd', dragEndParams(grid.props.items, from, to))
// which calls the screen's onDragEnd exactly as the library would.
import { Fragment, type ReactNode } from 'react';
import { View } from 'react-native';

type GridProps<T> = {
  data: T[];
  renderItem: (info: { item: T; index: number }) => ReactNode;
  keyExtractor?: (item: T) => string;
  onDragEnd?: (params: { data: T[]; fromIndex: number; toIndex: number }) => void;
};

function Grid<T>({ data, renderItem, keyExtractor, onDragEnd }: GridProps<T>) {
  return (
    <View testID="sortable-grid" {...({ onDragEnd, items: data } as object)}>
      {data.map((item, index) => (
        <Fragment key={keyExtractor ? keyExtractor(item) : index}>
          {renderItem({ item, index })}
        </Fragment>
      ))}
    </View>
  );
}

function Handle({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

// What the library passes to onDragEnd after dragging the item at `from` to `to`.
export function dragEndParams<T>(data: readonly T[], from: number, to: number) {
  const next = [...data];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return { data: next, fromIndex: from, toIndex: to };
}

const Sortable = { Grid, Handle };

export default Sortable;
