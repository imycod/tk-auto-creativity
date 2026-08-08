import { addDialog, closeDialog } from "@/components/ReDialog";
import { message } from "@/utils/message";
import dayjs from "dayjs";

// 如果您不习惯tsx写法，可以传slot，然后在template里写
// 需是hooks写法（函数中有return），避免失去响应性
export function useColumns() {
  const statusMap = {
    "pending": "等待中",
    "queued": "已入队",
    "processing": "生成中",
    "completed": "生成完毕",
    "failed": "生成失败",
    "retrying": "重试中"
  };
  const statusColorMap = {
    "pending": "primary",
    "queued": "success",
    "processing": "warning",
    "completed": "success",
    "failed": "danger",
    "retrying": "warning"
  };
  const statusButtonMap = {
    "pending": "生成",
    "queued": "取消",
    "processing": "取消",
    "completed": "查看",
    "failed": "查看"
  };
  const columns: TableColumnList = [
    {
      label: "任务ID",
      prop: "taskId",
      sortable: "custom",
      width: 150,
      fixed: "left",
      showOverflowTooltip: false,
      cellRenderer: ({ row }) => (
        <span style="margin-left: 10px" class="line-clamp-1">{row.taskId}</span>
      )
    },
    {
      label: "产品ID",
      prop: "productId",
      width: 150,
      cellRenderer: ({ index, row }) => (
        <div style="display: flex; align-items: center">
          <span style="margin-left: 10px">{row.productId}</span>
        </div>
      )
    },
    {
      label: "提示词",
      width: 400,
      prop: "promptText",
      showOverflowTooltip: false,
      cellRenderer: ({ index, row }) => (
        <div style="width: 400px;">
          <iconify-icon-online icon="ep:prompt" />
          <span style="margin-left: 10px" class="line-clamp-1 pointer cursor-pointer" onClick={() => handlePromptText(index + 1, row)}>{row.promptText}</span>
        </div>
      )
    },
    {
      label: "图像",
      prop: "assets",
      width: 400,
      cellRenderer: ({ index, row }) => (
        <div style="display: flex; align-items: center">
          {[...(row.assets ?? [])]
            .sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0) || Number(a?.assetId ?? 0) - Number(b?.assetId ?? 0))
            .map(item => item?.assetType === "video" ? (
              <video src={item?.assetPath} controls muted class="size-25 object-cover" />
            ) : (
              <el-image
                preview-teleported
                loading="lazy"
                src={item?.assetPath}
                preview-src-list={(row.assets ?? []).filter(v => v?.assetType !== "video").map(v => v?.assetPath)}
                fit="cover"
                class="size-25"
              />
            ))}
        </div>
      )
    },
    {
      label: "视频时长",
      prop: "duration",
      width: 100,
      cellRenderer: ({ row }) => (
        <span style="margin-left: 10px">{row.duration ?? 14}s</span>
      )
    },
    {
      label: "Worker",
      prop: "queues",
      width: 180,
      cellRenderer: ({ row }) => {
        const queue = Array.isArray(row.queues) ? row.queues[0] : null;
        if (!queue) return <span style="margin-left: 10px">-</span>;
        const worker =
          queue.workerId ||
          (queue.profileIndex != null ? `worker-${queue.profileIndex}` : null);
        let excluded = [];
        try {
          excluded = queue.excludedWorkers
            ? JSON.parse(queue.excludedWorkers)
            : [];
        } catch {
          excluded = [];
        }
        const excludedText =
          Array.isArray(excluded) && excluded.length
            ? `排除: ${excluded.join(',')}`
            : '';
        const roundText =
          queue.scheduleRound > 0 ? `轮次: ${queue.scheduleRound}` : '';
        return (
          <div style="margin-left: 10px; line-height: 1.4">
            <div>{worker || '-'}</div>
            {excludedText ? (
              <div style="color: var(--el-color-warning); font-size: 12px">
                {excludedText}
              </div>
            ) : null}
            {roundText ? (
              <div style="color: var(--el-text-color-secondary); font-size: 12px">
                {roundText}
              </div>
            ) : null}
          </div>
        );
      }
    },
    {
      label: "状态",
      prop: "status",
      cellRenderer: ({ index, row }) => (
        <el-tag type={statusColorMap[row.status]}>{statusMap[row.status]}</el-tag>
      )
    },
   
    {
      label: "批次日期",
      width: 150,
      prop: "batchDate",
      cellRenderer: ({ index, row }) => (
        <div style="display: flex; align-items: center">
          <span style="margin-left: 10px">{row.batchDate}</span>
        </div>
      )
    },
    {
      label: "创建时间",
      width: 150,
      prop: "createdAt",
      sortable: "custom",
      formatter: (row, _column, cellValue) =>
        cellValue
          ? dayjs(cellValue).format("YYYY-MM-DD HH:mm:ss")
          : row.createdAt
            ? dayjs(row.createdAt).format("YYYY-MM-DD HH:mm:ss")
            : "-",
    },
    {
      label: "更新时间",
      prop: "updatedAt",
      width: 150,
      formatter: (row, _column, cellValue) =>
        cellValue
          ? dayjs(cellValue).format("YYYY-MM-DD HH:mm:ss")
          : row.updatedAt
            ? dayjs(row.updatedAt).format("YYYY-MM-DD HH:mm:ss")
            : "-",
    },
    {
      label: "操作",
      width: 300,
      fixed: "right",
      slot: "operation"
      // cellRenderer: ({ index, row }) => (
      //   <>
      //     <el-button size="small" type="primary" onClick={() => handleGenerate(index + 1, row)}>
      //       {statusButtonMap[row.status]}
      //     </el-button>
      //     <el-button size="small" onClick={() => handleEdit(index + 1, row)}>
      //       编辑
      //     </el-button>
      //     <el-button
      //       size="small"
      //       type="danger"
      //       onClick={() => handleDelete(index + 1, row)}
      //     >
      //       删除
      //     </el-button>
      //   </>
      // )
    }
  ];

  const handlePromptText = (index: number, row) => {
    addDialog({
      title: "提示词",
      width: "500px",
      contentRenderer: ({ options, index }) => (
        <el-card shadow="never">
          {row.promptText}
        </el-card>
      ),
    });
  };

  return {
    statusMap,
    columns,
    statusButtonMap,
    statusColorMap,
  };
}