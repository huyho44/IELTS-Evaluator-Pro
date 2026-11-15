import image from "./image.svg";
import vector from "./vector.svg";
import vector2 from "./vector-2.svg";

export const AdminHeaderSection = (): JSX.Element => {
  return (
    <header
      className="absolute top-0 left-0 flex h-16 w-full items-center justify-between border border-solid border-slate-200 bg-white px-8 py-0"
      aria-label="Admin header"
    >
      <div className="relative flex h-[27px] w-[308px] items-center gap-3.5">
        <h1 className="relative mt-[-1.00px] w-[178px] [font-family:'Inter-Bold',Helvetica] text-lg font-bold leading-[27px] tracking-[0] text-blue-600">
          IELTS Evaluator Pro
        </h1>
        <div
          className="relative flex h-[27px] w-[116px] items-center gap-1.5 rounded-[7px] border border-solid border-purple-200 bg-purple-100 px-2.5 py-[5px]"
          aria-label="Admin Console"
        >
          <span className="relative mt-[-1.00px] w-[94px] [font-family:'Inter-SemiBold',Helvetica] text-[11px] font-semibold leading-[17px] tracking-[0] text-purple-700">
            Admin Console
          </span>
        </div>
      </div>
      <div className="relative flex h-[49px] w-[300px] items-center gap-[18px]">
        <button
          type="button"
          className="relative h-5 w-5 cursor-pointer"
          aria-label="Notifications"
        >
          <img
            className="absolute left-[38.62%] top-[83.33%] h-[16.67%] w-[61.38%]"
            alt=""
            aria-hidden="true"
            src={vector}
          />
          <img
            className="absolute left-[8.34%] top-[4.17%] h-[95.83%] w-[91.66%]"
            alt=""
            aria-hidden="true"
            src={image}
          />
        </button>
        <button
          type="button"
          className="relative flex h-[49px] w-[262px] items-center gap-2.5 rounded-[99px] border border-solid border-slate-200 bg-slate-50 py-1.5 pl-2 pr-3.5 text-left"
          aria-label="Open account menu for Phạm Quang Huy"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-[99px] bg-blue-100">
            <span className="relative w-5 text-center [font-family:'Inter-Bold',Helvetica] text-sm font-bold leading-[21px] tracking-[0] text-blue-700">
              P
            </span>
          </span>
          <span className="relative flex w-[170px] flex-col items-start">
            <span className="relative mt-[-1.00px] w-[170px] [font-family:'Inter-Bold',Helvetica] text-[13px] font-bold leading-5 tracking-[0] text-slate-900">
              Phạm Quang Huy
            </span>
            <span className="relative w-[170px] [font-family:'Inter-SemiBold',Helvetica] text-[11px] font-semibold leading-[17px] tracking-[0] text-blue-600">
              Administrator
            </span>
          </span>
          <span className="relative h-4 w-4" aria-hidden="true">
            <img
              className="absolute left-[20.83%] top-[33.33%] h-[66.67%] w-[79.17%]"
              alt=""
              src={vector2}
            />
          </span>
        </button>
      </div>
    </header>
  );
};
