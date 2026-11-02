module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "public": "/" });

  // Узел каталога по id
  eleventyConfig.addFilter("findById", function(items, id) {
    if (!Array.isArray(items) || !id) return null;
    return items.find(function(item) { return item.id === id; }) || null;
  });

  // Дочерние узлы (подкатегории или товары)
  eleventyConfig.addFilter("childrenOf", function(items, parentId) {
    if (!Array.isArray(items) || !parentId) return [];
    return items.filter(function(item) { return item.parent_id === parentId; });
  });

  // Цепочка предков от корня до непосредственного родителя
  eleventyConfig.addFilter("ancestorsOf", function(items, node) {
    var chain = [];
    if (!Array.isArray(items) || !node) return chain;
    var current = node;
    var guard = 0;
    while (current && current.parent_id && guard < 20) {
      var parent = items.find(function(item) { return item.id === current.parent_id; });
      if (!parent) break;
      chain.unshift(parent);
      current = parent;
      guard++;
    }
    return chain;
  });

  return { dir: { input: "src", output: "dist", includes: "_includes" } };
};