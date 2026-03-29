import React from 'react';
import { FlatList, View } from 'react-native';

const DraggableFlatList = React.forwardRef((props, ref) => {
  const { renderItem, data, ...rest } = props;
  return React.createElement(FlatList, {
    ...rest,
    ref,
    data,
    renderItem: ({ item, index }) =>
      renderItem({ item, index, drag: () => {}, isActive: false, getIndex: () => index }),
  });
});

DraggableFlatList.displayName = 'DraggableFlatList';

export const ScaleDecorator = ({ children }) => React.createElement(View, null, children);
export default DraggableFlatList;
