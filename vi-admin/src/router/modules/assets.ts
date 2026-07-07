const { VITE_HIDE_HOME } = import.meta.env;
const Layout = () => import("@/layout/index.vue");

export default {
  path: "/",
  name: "AssetsHome",
  component: Layout,
  redirect: "/assets",
  meta: {
    icon: "fa-solid:box-open",
    title: "资产列表",
    rank: 1
  },
  children: [
    {
      path: "/assets",
      name: "AssetsList",
      component: () => import("@/views/assets/index.vue"),
      meta: {
        title: "资产列表",
      }
    },
  ]
} satisfies RouteConfigsTable;
