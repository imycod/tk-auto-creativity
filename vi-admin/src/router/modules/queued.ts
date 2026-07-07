const { VITE_HIDE_HOME } = import.meta.env;
const Layout = () => import("@/layout/index.vue");

export default {
  path: "/",
  name: "QueuedHome",
  component: Layout,
  redirect: "/queued",
  meta: {
    icon: "fa-solid:battery-quarter",
    title: "任务队列",
    rank: 1
  },
  children: [
    {
      path: "/queued",
      name: "QueuedList",
      component: () => import("@/views/queued/index.vue"),
      meta: {
        title: "任务队列",
      }
    },
  ]
} satisfies RouteConfigsTable;
