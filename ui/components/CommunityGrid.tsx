// import React from 'react';
// import { Heart, User, Eye, ArrowRight } from 'lucide-react';
// import { motion } from 'framer-motion';

// const projects = [
//   {
//     id: 1,
//     title: "Nano Banana Pro Playground",
//     author: "AlexChen",
//     image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop",
//     likes: 478,
//     views: "3.9K",
//     type: "Free"
//   },
//   {
//     id: 2,
//     title: "Brilliance SaaS Landing Page",
//     author: "SarahDesign",
//     image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop",
//     likes: 1500,
//     views: "9.7K",
//     type: "Free"
//   },
//   {
//     id: 3,
//     title: "3D Gallery Photography Template",
//     author: "H/S_Studio",
//     image: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2670&auto=format&fit=crop",
//     likes: 674,
//     views: "2.8K",
//     type: "1 Credit"
//   },
//   {
//     id: 4,
//     title: "Opus Landing Page",
//     author: "OpusTeam",
//     image: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=2555&auto=format&fit=crop",
//     likes: 163,
//     views: "581",
//     type: "Free"
//   },
//   {
//     id: 5,
//     title: "AI Gateway Starter",
//     author: "DevMike",
//     image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop",
//     likes: 215,
//     views: "1.1K",
//     type: "Free"
//   },
//   {
//     id: 6,
//     title: "Globe To Map Transform",
//     author: "GeoViz",
//     image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2672&auto=format&fit=crop",
//     likes: 394,
//     views: "1.3K",
//     type: "Free"
//   }
// ];

// export const CommunityGrid = () => {
//   return (
//     <div className="w-full max-w-[1400px] mx-auto px-6 py-12">
//       <div className="flex items-center justify-between mb-8">
//         <div>
//           <h2 className="text-xl font-semibold text-white mb-1">From the Community</h2>
//           <p className="text-sm text-neutral-400">Explore what the community is building with PhaseHumans.</p>
//         </div>
//         <button className="text-sm text-neutral-400 hover:text-white flex items-center gap-1 transition-colors">
//           Browse All <ArrowRight size={14} />
//         </button>
//       </div>

//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//         {projects.map((project, idx) => (
//           <motion.div 
//             key={project.id}
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ delay: idx * 0.1 }}
//             className="group cursor-pointer"
//           >
//             <div className="relative aspect-[16/10] bg-neutral-900 rounded-xl overflow-hidden mb-3 border border-white/5 group-hover:border-white/20 transition-all">
//                <img 
//                  src={project.image} 
//                  alt={project.title}
//                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100"
//                />
//                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
//                <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] font-medium text-white border border-white/10">
//                   {project.type}
//                </div>
//             </div>
            
//             <div className="flex items-start justify-between">
//                 <div>
//                     <h3 className="text-white font-medium text-sm mb-1 group-hover:text-blue-400 transition-colors">{project.title}</h3>
//                     <div className="flex items-center gap-4 text-xs text-neutral-500">
//                         <div className="flex items-center gap-1.5 hover:text-neutral-300">
//                             <div className="w-4 h-4 rounded-full bg-neutral-800 flex items-center justify-center">
//                                 <User size={10} />
//                             </div>
//                             {project.author}
//                         </div>
//                         <div className="flex items-center gap-3">
//                             <span className="flex items-center gap-1"><User size={10} /> {project.views}</span>
//                             <span className="flex items-center gap-1"><Heart size={10} /> {project.likes}</span>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//           </motion.div>
//         ))}
//       </div>
//     </div>
//   );
// };