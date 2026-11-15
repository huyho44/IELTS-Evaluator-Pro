import { useState } from "react";
import image from "./image.svg";
import vector from "./vector.svg";
import vector2 from "./vector-2.svg";

export const AdminHeaderSection = () => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  return (
    <header className="w-full h-16 items-center justify-between px-8 py-0 top-0 border-b [border-bottom-style:solid] flex absolute left-0 bg-white border-[#e8e5ef]">
      <div className="inline-flex h-[27px] items-center gap-3.5 relative flex-[0_0_auto]">
        <h1 className="relative w-[178px] mt-[-1.00px] [font-family:'Inter-Bold',Helvetica] font-bold text-violet-600 text-xl tracking-[0] leading-[27px]">
          Admin Console
        </h1>
        <span className="flex w-[156px] h-[27px] items-center gap-1.5 px-2.5 py-[5px] relative bg-[#f3edff] rounded-[7px] border border-solid border-purple-200">
          <span className="relative w-fit mt-[-1.00px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-violet-600 text-[11px] tracking-[0] leading-[17px] whitespace-nowrap">
            IELTS Evaluator Pro
          </span>
        </span>
      </div>
      <div className="flex w-[300px] h-[49px] items-center gap-[18px] relative">
        <button
          type="button"
          aria-label="View notifications"
          className="relative w-5 h-5 appearance-none border-0 bg-transparent p-0"
        >
          <img
            className="absolute w-[61.38%] h-[16.67%] top-[83.33%] left-[38.62%]"
            alt=""
            aria-hidden="true"
            src={vector}
          />
          <img
            className="absolute w-[91.66%] h-[95.83%] top-[4.17%] left-[8.34%]"
            alt=""
            aria-hidden="true"
            src={image}
          />
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label="Open administrator profile menu"
            aria-haspopup="menu"
            aria-expanded={isProfileMenuOpen}
            onClick={() => setIsProfileMenuOpen((isOpen) => !isOpen)}
            className="flex w-[262px] h-[49px] items-center gap-2.5 pl-2 pr-3.5 py-1.5 relative bg-slate-50 rounded-[99px] border border-solid border-slate-200 text-left"
          >
            <span className="flex w-8 h-8 items-center justify-center relative bg-blue-100 rounded-[99px]">
              <span className="relative w-5 [font-family:'Inter-Bold',Helvetica] font-bold text-violet-600 text-sm text-center tracking-[0] leading-[21px]">
                P
              </span>
            </span>
            <span className="flex flex-col w-[170px] items-start relative">
              <span className="relative w-[170px] mt-[-1.00px] [font-family:'Inter-Bold',Helvetica] font-bold text-slate-900 text-[13px] tracking-[0] leading-5">
                Phạm Quang Huy
              </span>
              <span className="relative w-[170px] [font-family:'Inter-SemiBold',Helvetica] font-semibold text-violet-600 text-[11px] tracking-[0] leading-[17px]">
                Administrator
              </span>
            </span>
            <span className="relative w-4 h-4">
              <img
                className="absolute w-[79.17%] h-[66.67%] top-[33.33%] left-[20.83%]"
                alt=""
                aria-hidden="true"
                src={vector2}
              />
            </span>
          </button>
          {isProfileMenuOpen && (
            <div
              role="menu"
              aria-label="Administrator profile menu"
              className="absolute right-0 top-[55px] z-10 w-[262px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="w-full rounded-md px-3 py-2 text-left [font-family:'Inter-SemiBold',Helvetica] text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setIsProfileMenuOpen(false)}
              >
                Account settings
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full rounded-md px-3 py-2 text-left [font-family:'Inter-SemiBold',Helvetica] text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setIsProfileMenuOpen(false)}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
